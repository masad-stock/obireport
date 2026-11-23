import { Resend } from 'resend';
import { adminAuth } from '../lib/firebase-admin.ts';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ObiReport <noreply@obireport.app>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

export async function sendVerificationEmail(email: string, uid: string): Promise<void> {
  try {
    const link = await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/verify-email`,
      handleCodeInApp: true,
    });

    const client = getResendClient();
    await client.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Verify your ObiReport account',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #1e293b; font-size: 24px;">Welcome to ObiReport</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Thanks for signing up! Please verify your email address to activate your account.
          </p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="display: inline-block; background: #1d4ed8; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Verify Email Address
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 14px;">
            If the button doesn't work, copy this link:<br>
            <a href="${link}" style="color: #1d4ed8; word-break: break-all;">${link}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            This link expires in 1 hour. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const link = await adminAuth.generatePasswordResetLink(email, {
      url: `${APP_URL}/reset-password`,
      handleCodeInApp: true,
    });

    const client = getResendClient();
    await client.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Reset your ObiReport password',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #1e293b; font-size: 24px;">Password Reset Request</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            We received a request to reset your ObiReport password. Click the button below to create a new password.
          </p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="display: inline-block; background: #1d4ed8; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 14px;">
            If the button doesn't work, copy this link:<br>
            <a href="${link}" style="color: #1d4ed8; word-break: break-all;">${link}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

export async function sendPaymentReceiptEmail(
  email: string,
  name: string | null,
  packageName: string,
  credits: number,
  amountKes: number,
  reference: string
): Promise<void> {
  try {
    const client = getResendClient();
    await client.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Your ObiReport Receipt - ${packageName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #1e293b; font-size: 24px;">Payment Receipt</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Hi ${name || 'there'},<br><br>
            Thank you for your purchase! Your payment has been processed successfully.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Package</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${packageName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Credits Added</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${credits}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">KES ${amountKes.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Reference</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${reference}</td>
              </tr>
            </table>
          </div>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Your credits are now available in your <a href="${APP_URL}/dashboard" style="color: #1d4ed8;">ObiReport dashboard</a>.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            If you have any questions, contact support at support@obireport.app
          </p>
        </div>
      `,
    });

    console.log(`Payment receipt email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send payment receipt email:', error);
  }
}