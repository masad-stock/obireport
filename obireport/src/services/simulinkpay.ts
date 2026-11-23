import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const SIMULINKPAY_BASE_URL = 'https://simulinkpay.co.ke/api/v1';

export interface CreditPackage {
  id: string;
  name: string;
  audience: string;
  credits: number;
  amountKes: number;
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
    perCheckKes: 150,
    features: ['1 full similarity & AI report', 'PDF verification certificate', 'Up to 50 MB PDF, DOCX, or TXT'],
  },
  {
    id: 'scholar_pack',
    name: 'Scholar 5-Pack',
    audience: 'For thesis & dissertation drafts',
    credits: 5,
    amountKes: 650,
    perCheckKes: 130,
    features: ['5 report credits (KES 130/check)', 'Section-by-section breakdown', 'Priority queue & archival'],
  },
  {
    id: 'research_pack',
    name: 'Research 15-Pack',
    audience: 'For academic labs & editorial teams',
    credits: 15,
    amountKes: 1650,
    perCheckKes: 110,
    features: ['15 report credits (KES 110/check)', 'Multi-draft revision history', 'Full PDF report exports'],
  },
];

export interface SimulinkPayConfig {
  apiToken: string;
  receivingAccountId: number;
  webhookSecret: string;
}

function getConfig(): SimulinkPayConfig {
  const apiToken = process.env.SIMULINKPAY_API_TOKEN?.trim();
  const receivingAccountId = Number(process.env.SIMULINKPAY_RECEIVING_ACCOUNT_ID?.trim());
  const webhookSecret = process.env.SIMULINKPAY_WEBHOOK_SECRET?.trim();

  if (!apiToken) {
    throw new Error('SIMULINKPAY_API_TOKEN is not configured');
  }
  if (!receivingAccountId || Number.isNaN(receivingAccountId)) {
    throw new Error('SIMULINKPAY_RECEIVING_ACCOUNT_ID is not configured or invalid');
  }
  if (!webhookSecret) {
    throw new Error('SIMULINKPAY_WEBHOOK_SECRET is not configured');
  }

  return { apiToken, receivingAccountId, webhookSecret };
}

export function isSimulinkPayConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
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

export interface SimulinkPayPaymentResponse {
  id: number;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  fee_bearer: 'merchant' | 'payer' | 'shared';
  payer_fee: number;
  amount_charged: number;
  currency: 'KES';
  payment_link_id: number | null;
  reference: string | null;
  receipt_number: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface StkPushResult {
  paymentId: number;
  paymentStatus: 'pending' | 'succeeded' | 'failed';
  amountCharged: number;
  rawResponse: SimulinkPayPaymentResponse;
}

export interface FeesQuoteResponse {
  amount: number;
  fee_bearer: 'merchant' | 'payer' | 'shared';
  fee: number;
  payer_fee: number;
  amount_charged: number;
  currency: 'KES';
}

export interface WalletResponse {
  balance: number;
  currency: 'KES';
}

export interface WalletTopupResponse {
  id: number;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  currency: 'KES';
  created_at: string;
  completed_at: string | null;
}

async function simulinkPayFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiToken } = getConfig();
  const url = `${SIMULINKPAY_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorType = (payload.error as { type?: string })?.type;
    const errorMessage = (payload.error as { message?: string })?.message;
    const errorParam = (payload.error as { param?: string })?.param;

    const error = new SimulinkPayError(
      errorMessage || `SimulinkPay API error: ${response.status}`,
      response.status,
      errorType,
      errorParam
    );
    throw error;
  }

  return payload as T;
}

export class SimulinkPayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorType?: string,
    public readonly param?: string
  ) {
    super(message);
    this.name = 'SimulinkPayError';
  }
}

export async function getFeesQuote(amount: number): Promise<FeesQuoteResponse> {
  if (amount < 1 || amount > 150000) {
    throw new Error('Amount must be between 1 and 150,000 KES');
  }
  return simulinkPayFetch<FeesQuoteResponse>(`/fees/quote?amount=${amount}`);
}

export async function getWalletBalance(): Promise<WalletResponse> {
  return simulinkPayFetch<WalletResponse>('/wallet');
}

export async function topUpWallet(amount: number, idempotencyKey: string): Promise<WalletTopupResponse> {
  return simulinkPayFetch<WalletTopupResponse>('/wallet/topups', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ amount }),
  });
}

export async function getWalletTopupStatus(topupId: number): Promise<WalletTopupResponse> {
  return simulinkPayFetch<WalletTopupResponse>(`/wallet/topups/${topupId}`);
}

export async function initiateStkPush(params: {
  amountKes: number;
  phoneNumber: string;
  reference: string;
  description: string;
  feeBearer?: 'merchant' | 'payer' | 'shared';
}): Promise<StkPushResult> {
  const { receivingAccountId } = getConfig();
  const idempotencyKey = uuidv4();

  const body = {
    receiving_account_id: receivingAccountId,
    amount: params.amountKes,
    customer_phone: params.phoneNumber,
    reference: params.reference,
    currency: 'KES',
    fee_bearer: params.feeBearer ?? 'merchant',
  };

  const payment = await simulinkPayFetch<SimulinkPayPaymentResponse>('/payments', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  return {
    paymentId: payment.id,
    paymentStatus: payment.status,
    amountCharged: payment.amount_charged,
    rawResponse: payment,
  };
}

export async function getPaymentStatus(paymentId: number): Promise<SimulinkPayPaymentResponse> {
  return simulinkPayFetch<SimulinkPayPaymentResponse>(`/payments/${paymentId}`);
}

export function verifySimulinkPayWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  const { webhookSecret } = getConfig();
  if (!webhookSecret || !signatureHeader) {
    return false;
  }

  const expectedHex = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const providedHex = signatureHeader.replace(/^sha256=/i, '').trim();

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const providedBuf = Buffer.from(providedHex, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export interface SimulinkPayWebhookEvent {
  id: number;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.pending';
  payment: SimulinkPayPaymentResponse;
}

export function parseSimulinkPayWebhook(body: string): SimulinkPayWebhookEvent {
  const parsed = JSON.parse(body) as SimulinkPayWebhookEvent;
  return parsed;
}