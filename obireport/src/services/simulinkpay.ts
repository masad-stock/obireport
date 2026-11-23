import crypto from 'node:crypto';

export interface CreditPackage {
  id: string;
  name: string;
  audience: string;
  credits: number;
  amountKes: number;
  amountCents: number;
  perCheckKes: number;
  features: string[];
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'single_check',
    name: 'Single Check',
    audience: 'For individual assignments',
    credits: 1,
    amountKes: 150,
    amountCents: 15000,
    perCheckKes: 150,
    features: ['1 full similarity & AI report', 'PDF verification certificate', 'Up to 50 MB PDF, DOCX, or TXT'],
  },
  {
    id: 'scholar_pack',
    name: 'Scholar 5-Pack',
    audience: 'For thesis & dissertation drafts',
    credits: 5,
    amountKes: 650,
    amountCents: 65000,
    perCheckKes: 130,
    features: ['5 report credits (KES 130/check)', 'Section-by-section breakdown', 'Priority queue & archival'],
  },
  {
    id: 'research_pack',
    name: 'Research 15-Pack',
    audience: 'For academic labs & editorial teams',
    credits: 15,
    amountKes: 1650,
    amountCents: 165000,
    perCheckKes: 110,
    features: ['15 report credits (KES 110/check)', 'Multi-draft revision history', 'Full PDF report exports'],
  },
];

export function isSimulinkPayConfigured(): boolean {
  return Boolean(process.env.SIMULINKPAY_API_URL?.trim() && process.env.SIMULINKPAY_API_KEY?.trim());
}

export function normalizeKenyanPhone(phone: string): string | null {
  const digits = phone.replace(/\D+/g, '');
  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^[17]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }
  return null;
}

export interface StkPushResult {
  transactionId: string;
  checkoutRequestId?: string;
  rawResponse: Record<string, unknown>;
}

export async function initiateSimulinkPayStkPush(params: {
  paymentId: string;
  phoneNumber: string;
  amountKes: number;
  reference: string;
  description: string;
}): Promise<StkPushResult> {
  const apiUrl = process.env.SIMULINKPAY_API_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.SIMULINKPAY_API_KEY?.trim();

  if (!apiUrl || !apiKey) {
    throw new Error(
      'SimulinkPay API credentials (SIMULINKPAY_API_URL, SIMULINKPAY_API_KEY) are not configured in server secrets.'
    );
  }

  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '') || '';
  const callbackUrl = appUrl ? `${appUrl}/api/payments/callback` : undefined;

  const response = await fetch(`${apiUrl}/v1/payments/stk-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: params.phoneNumber,
      amount: params.amountKes,
      currency: 'KES',
      reference: params.reference,
      external_id: params.paymentId,
      description: params.description,
      callback_url: callbackUrl,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const msg =
      typeof payload.message === 'string'
        ? payload.message
        : `SimulinkPay gateway returned status ${response.status}`;
    throw new Error(msg);
  }

  const txId =
    (typeof payload.transaction_id === 'string' && payload.transaction_id) ||
    (typeof payload.checkout_request_id === 'string' && payload.checkout_request_id) ||
    params.reference;

  return {
    transactionId: txId,
    checkoutRequestId:
      typeof payload.checkout_request_id === 'string' ? payload.checkout_request_id : undefined,
    rawResponse: payload,
  };
}

export function verifySimulinkPayWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  const secret = process.env.SIMULINKPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return false;
  }
  if (!signatureHeader) {
    return false;
  }

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedHex = signatureHeader.replace(/^sha256=/i, '').trim();

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const providedBuf = Buffer.from(providedHex, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
