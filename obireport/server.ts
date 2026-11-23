import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import {
  createPendingDocument,
  deleteUserDocument,
  getUserDashboardStats,
  getUserDocumentById,
  listUserDocuments,
  markDocumentCompleted,
  markDocumentFailedAndRefundCredit,
  reserveCreditAndStartProcessing,
} from './src/db/documents.ts';
import {
  attachGatewayTransaction,
  createPaymentRecord,
  listUserPayments,
  markPaymentFailed,
  reconcilePaymentWebhook,
} from './src/db/payments.ts';
import { updateUserDisplayName } from './src/db/users.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { sendVerificationEmail, sendPasswordResetEmail, sendPaymentReceiptEmail } from './src/services/email.ts';
import { analyzeDocumentContent, isTurnitinConfigured } from './src/services/analyzer.ts';
import {
  deleteStoredFile,
  MAX_FILE_SIZE_BYTES,
  saveAndExtractDocument,
} from './src/services/extraction.ts';
import { generateReportPdfBuffer } from './src/services/pdfExport.ts';
import { initR2Client } from './src/services/storage.ts';
import { enqueueDocumentJob, startQueueWorker, closeQueue } from './src/queue/documentQueue.ts';
import {
  CREDIT_PACKAGES,
  initiateSimulinkPayStkPush,
  isSimulinkPayConfigured,
  normalizeKenyanPhone,
  verifySimulinkPayWebhookSignature,
} from './src/services/simulinkpay.ts';

dotenv.config();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Initialize R2 client
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
  initR2Client({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: process.env.R2_PUBLIC_URL,
  });
  console.log('R2 storage initialized');
} else {
  console.warn('R2 storage not configured - file uploads will fail');
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Preserve rawBody for HMAC webhook signature verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// Queue-based document processing
async function enqueueAnalysisJob(params: {
  userId: number;
  documentId: string;
  filename: string;
  fileType: string;
  storagePath: string;
  extractedText: string;
}) {
  await enqueueDocumentJob(params);
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Auth / Profile endpoint
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const stats = await getUserDashboardStats(user.id);
    res.json({
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        credits: user.credits,
        createdAt: user.createdAt,
      },
      stats,
      integrations: {
        turnitinConfigured: isTurnitinConfigured(),
        simulinkpayConfigured: isSimulinkPayConfigured(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    res.status(500).json({ error: message });
  }
});

app.patch('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const rawName = (req.body as { fullName?: unknown })?.fullName;
    if (typeof rawName !== 'string' || rawName.trim().length < 2 || rawName.trim().length > 100) {
      res.status(400).json({ error: 'Display name must be between 2 and 100 characters.' });
      return;
    }

    const updated = await updateUserDisplayName(user.id, rawName.trim());
    if (!updated) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl,
        credits: updated.credits,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile.';
    res.status(500).json({ error: message });
  }
});
// Email/Password Registration
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body as { email?: string; password?: string; fullName?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    if (fullName && (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100)) {
      res.status(400).json({ error: 'Display name must be between 2 and 100 characters.' });
      return;
    }

    // Check if user already exists
    try {
      await adminAuth.getUserByEmail(email);
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    } catch {
      // User doesn't exist, continue
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: fullName?.trim() || undefined,
      emailVerified: false,
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, userRecord.uid);
    } catch (emailError) {
      console.warn('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      uid: userRecord.uid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    res.status(500).json({ error: message });
  }
});

// Email/Password Login (handled client-side via Firebase JS SDK)
// Server just verifies ID token via existing /api/auth/me

// Forgot Password - Send reset email
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }

    // Check if user exists (don't reveal if not)
    try {
      await adminAuth.getUserByEmail(email);
    } catch {
      // User doesn't exist, but we return success for security
      res.json({ message: 'If an account exists, a password reset link has been sent.' });
      return;
    }

    // Send password reset email
    try {
      await sendPasswordResetEmail(email);
    } catch (emailError) {
      console.warn('Failed to send password reset email:', emailError);
    }

    res.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process request.';
    res.status(500).json({ error: message });
  }
});

// Verify Email (handle Firebase email verification link)
app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const { oobCode } = req.body as { oobCode?: string };

    if (!oobCode || typeof oobCode !== 'string') {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    await (adminAuth as any).verifyEmailVerificationCode(oobCode);

    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email verification failed.';
    res.status(400).json({ error: message });
  }
});

// Reset Password (handle Firebase password reset link)
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { oobCode, newPassword } = req.body as { oobCode?: string; newPassword?: string };

    if (!oobCode || typeof oobCode !== 'string') {
      res.status(400).json({ error: 'Invalid reset code.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    await (adminAuth as any).verifyPasswordResetCode(oobCode);
    await (adminAuth as any).confirmPasswordReset(oobCode, newPassword);

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed.';
    res.status(400).json({ error: message });
  }
});

// List documents with pagination & filtering
app.get('/api/documents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const scoreRangeRaw = typeof req.query.scoreRange === 'string' ? req.query.scoreRange : 'all';
    const scoreRange =
      scoreRangeRaw === 'low' || scoreRangeRaw === 'moderate' || scoreRangeRaw === 'high'
        ? scoreRangeRaw
        : 'all';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
    const sortBy =
      sortByRaw === 'similarityScore' || sortByRaw === 'aiScore' || sortByRaw === 'filename'
        ? sortByRaw
        : 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const data = await listUserDocuments({
      userId: user.id,
      page,
      limit,
      status,
      search,
      scoreRange,
      dateFrom,
      dateTo,
      sortBy,
      sortDir,
    });
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list documents.';
    res.status(500).json({ error: message });
  }
});

// Upload document (and optionally start analysis immediately)
app.post(
  '/api/documents/upload',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'File upload failed.';
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please select a PDF, DOCX, or TXT file to upload.' });
        return;
      }

      const extracted = await saveAndExtractDocument({
        userId: user.id,
        originalName: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      });

      const created = await createPendingDocument({
        userId: user.id,
        filename: extracted.safeOriginalName,
        fileSize: file.size,
        fileType: extracted.fileType,
        wordCount: extracted.wordCount,
        storagePath: extracted.storagePath,
        extractedText: extracted.extractedText,
      });

      const autoProcess = req.body?.autoProcess === 'true' || req.body?.autoProcess === true;
      if (autoProcess) {
        const reservation = await reserveCreditAndStartProcessing(user.id, created.id);
        if (reservation.kind === 'insufficient_credits') {
          res.status(201).json({
            document: created,
            processingStarted: false,
            requiresCredits: true,
            message: 'Document uploaded. Add report credits to run similarity and AI verification.',
          });
          return;
        }
        if (reservation.kind === 'started') {
          await enqueueAnalysisJob({
            userId: user.id,
            documentId: created.id,
            filename: created.filename,
            fileType: created.fileType,
            storagePath: created.storagePath,
            extractedText: extracted.extractedText,
          });
          res.status(202).json({
            document: reservation.document,
            processingStarted: true,
            remainingCredits: reservation.remainingCredits,
          });
          return;
        }
      }

      res.status(201).json({
        document: created,
        processingStarted: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      res.status(400).json({ error: message });
    }
  }
);

// Trigger verification processing on an existing pending/failed document
app.post('/api/documents/:id/process', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const documentId = req.params.id;
    if (!UUID_REGEX.test(documentId)) {
      res.status(400).json({ error: 'Invalid document identifier.' });
      return;
    }

    const reservation = await reserveCreditAndStartProcessing(user.id, documentId);
    if (reservation.kind === 'not_found') {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    if (reservation.kind === 'already_processing') {
      res.status(202).json({
        document: reservation.document,
        processingStarted: true,
      });
      return;
    }
    if (reservation.kind === 'insufficient_credits') {
      res.status(402).json({
        error: 'Insufficient report credits. Purchase credits via SimulinkPay M-Pesa to run this check.',
      });
      return;
    }

    const doc = reservation.document;
    await enqueueAnalysisJob({
      userId: user.id,
      documentId: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      storagePath: doc.storagePath,
      extractedText: doc.extractedText || '',
    });

    res.status(202).json({
      document: doc,
      processingStarted: true,
      remainingCredits: reservation.remainingCredits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start verification.';
    res.status(500).json({ error: message });
  }
});

// Get single document detail + full report
app.get('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const documentId = req.params.id;
    if (!UUID_REGEX.test(documentId)) {
      res.status(400).json({ error: 'Invalid document identifier.' });
      return;
    }

    const doc = await getUserDocumentById(user.id, documentId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    res.json({ document: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load document.';
    res.status(500).json({ error: message });
  }
});

// Poll processing status
app.get('/api/documents/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const documentId = req.params.id;
    if (!UUID_REGEX.test(documentId)) {
      res.status(400).json({ error: 'Invalid document identifier.' });
      return;
    }

    const doc = await getUserDocumentById(user.id, documentId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    res.json({
      id: doc.id,
      status: doc.status,
      similarityScore: doc.similarityScore,
      aiScore: doc.aiScore,
      errorMessage: doc.errorMessage,
      completedAt: doc.completedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check document status.';
    res.status(500).json({ error: message });
  }
});

// Export PDF report
app.get('/api/documents/:id/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const documentId = req.params.id;
    if (!UUID_REGEX.test(documentId)) {
      res.status(400).json({ error: 'Invalid document identifier.' });
      return;
    }

    const doc = await getUserDocumentById(user.id, documentId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    if (doc.status !== 'completed') {
      res.status(400).json({ error: 'PDF export is only available once verification is complete.' });
      return;
    }

    const pdfBuffer = await generateReportPdfBuffer(doc);
    const baseName = path.parse(doc.filename).name.replace(/[^\w\-]+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_ObiReport.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF report.';
    res.status(500).json({ error: message });
  }
});

// Delete document
app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const documentId = req.params.id;
    if (!UUID_REGEX.test(documentId)) {
      res.status(400).json({ error: 'Invalid document identifier.' });
      return;
    }

    const deleted = await deleteUserDocument(user.id, documentId);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    await deleteStoredFile(user.id, deleted.storagePath);
    res.json({ deletedId: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete document.';
    res.status(500).json({ error: message });
  }
});

// Payment packages & gateway availability
app.get('/api/payments/packages', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({
    packages: CREDIT_PACKAGES,
    simulinkpayConfigured: isSimulinkPayConfigured(),
  });
});

// Payment balance
app.get('/api/payments/balance', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    res.json({
      credits: user.credits,
      currency: 'KES',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch credit balance.';
    res.status(500).json({ error: message });
  }
});

// Payment history
app.get('/api/payments/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const history = await listUserPayments(user.id);
    res.json({ payments: history });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payment history.';
    res.status(500).json({ error: message });
  }
});

// Initiate SimulinkPay M-Pesa STK Push
app.post('/api/payments/initiate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const { packageId, phoneNumber, documentId } = req.body as {
      packageId?: string;
      phoneNumber?: string;
      documentId?: string;
    };

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      res.status(400).json({ error: 'Please select a valid credit package.' });
      return;
    }

    const normalizedPhone = normalizeKenyanPhone(phoneNumber || '');
    if (!normalizedPhone) {
      res.status(400).json({
        error: 'Enter a valid M-Pesa phone number (e.g., 0712345678 or 254712345678).',
      });
      return;
    }

    if (!isSimulinkPayConfigured()) {
      res.status(503).json({
        error:
          'SimulinkPay live gateway credentials (SIMULINKPAY_API_URL, SIMULINKPAY_API_KEY) are not configured in server secrets.',
      });
      return;
    }

    const validDocId = documentId && UUID_REGEX.test(documentId) ? documentId : null;
    const reference = `OBI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const paymentRecord = await createPaymentRecord({
      userId: user.id,
      documentId: validDocId,
      amountCents: pkg.amountCents,
      creditsPurchased: pkg.credits,
      currency: 'KES',
      phoneNumber: normalizedPhone,
      reference,
      description: `${pkg.name} (${pkg.credits} ObiReport credits)`,
    });

    try {
      const stk = await initiateSimulinkPayStkPush({
        paymentId: paymentRecord.id,
        phoneNumber: normalizedPhone,
        amountKes: pkg.amountKes,
        reference,
        description: paymentRecord.description || pkg.name,
      });

      const updated = await attachGatewayTransaction(paymentRecord.id, stk.transactionId, stk.rawResponse);
      res.status(201).json({
        payment: updated ?? paymentRecord,
        message: `M-Pesa STK push sent to +${normalizedPhone}. Confirm on your handset to receive ${pkg.credits} credits.`,
      });
    } catch (gatewayError) {
      const msg =
        gatewayError instanceof Error ? gatewayError.message : 'SimulinkPay STK Push failed.';
      await markPaymentFailed(paymentRecord.id, { error: msg });
      res.status(502).json({ error: msg });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initiate payment.';
    res.status(500).json({ error: message });
  }
});

// SimulinkPay webhook callback
app.post('/api/payments/callback', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header('x-simulinkpay-signature') || req.header('x-signature');

    if (!rawBody || !verifySimulinkPayWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const payload = req.body as Record<string, unknown>;
    const ref =
      (typeof payload.external_id === 'string' && payload.external_id) ||
      (typeof payload.reference === 'string' && payload.reference) ||
      (typeof payload.transaction_id === 'string' && payload.transaction_id) ||
      '';

    if (!ref) {
      res.status(400).json({ error: 'Missing payment reference in webhook payload.' });
      return;
    }

    const rawStatus = String(payload.status || '').toLowerCase();
    const status =
      rawStatus === 'completed' || rawStatus === 'success' || rawStatus === 'paid'
        ? 'completed'
        : 'failed';

    const txId = typeof payload.transaction_id === 'string' ? payload.transaction_id : undefined;

    const result = await reconcilePaymentWebhook({
      referenceOrExternalId: ref,
      status,
      transactionId: txId,
      metadata: payload,
    });

    if (!result.found) {
      res.status(404).json({ error: 'Referenced payment not found.' });
      return;
    }

    // Send payment receipt email on successful payment
    if (status === 'completed' && result.payment && !result.alreadyProcessed) {
      try {
        const userRecord = await adminAuth.getUser(String(result.payment.userId));
        if (userRecord.email) {
          await sendPaymentReceiptEmail(
            userRecord.email,
            userRecord.displayName ?? null,
            result.payment.description || 'Credit Purchase',
            result.payment.creditsPurchased,
            result.payment.amountCents / 100,
            result.payment.simulinkpayReference || result.payment.id
          );
        }
      } catch (emailError) {
        console.warn('Failed to send payment receipt email:', emailError);
      }
    }

    res.json({ received: true, status: result.payment?.status });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Start queue worker if Redis is configured
  if (process.env.REDIS_URL) {
    try {
      await startQueueWorker();
      console.log('Document processing queue worker started');
    } catch (err) {
      console.error('Failed to start queue worker:', err);
    }
  } else {
    console.warn('REDIS_URL not configured - queue worker not started');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ObiReport server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
