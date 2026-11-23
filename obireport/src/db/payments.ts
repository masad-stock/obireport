import { desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { payments, users } from './schema.ts';

export async function createPaymentRecord(input: {
  userId: number;
  documentId?: string | null;
  amountCents: number;
  creditsPurchased: number;
  currency?: string;
  phoneNumber: string;
  reference: string;
  description: string;
}) {
  try {
    const [created] = await db
      .insert(payments)
      .values({
        userId: input.userId,
        documentId: input.documentId ?? null,
        amountCents: input.amountCents,
        creditsPurchased: input.creditsPurchased,
        currency: input.currency ?? 'KES',
        status: 'pending',
        simulinkpayReference: input.reference,
        phoneNumber: input.phoneNumber,
        description: input.description,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createPaymentRecord:', error);
    throw new Error('Failed to initialize payment record.', { cause: error });
  }
}

export async function attachGatewayTransaction(
  paymentId: string,
  transactionId: string,
  metadata: Record<string, unknown>
) {
  try {
    const [updated] = await db
      .update(payments)
      .set({
        simulinkpayTransactionId: transactionId,
        metadata,
      })
      .where(eq(payments.id, paymentId))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in attachGatewayTransaction:', error);
    throw new Error('Failed to record gateway transaction reference.', { cause: error });
  }
}

export async function markPaymentFailed(paymentId: string, metadata: Record<string, unknown>) {
  try {
    const [updated] = await db
      .update(payments)
      .set({
        status: 'failed',
        metadata,
      })
      .where(eq(payments.id, paymentId))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in markPaymentFailed:', error);
    throw new Error('Failed to update payment status.', { cause: error });
  }
}

export async function reconcilePaymentWebhook(params: {
  referenceOrExternalId: string;
  status: 'completed' | 'failed';
  transactionId?: string;
  metadata: Record<string, unknown>;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(payments)
        .where(
          sql`${payments.id}::text = ${params.referenceOrExternalId} OR ${payments.simulinkpayReference} = ${params.referenceOrExternalId} OR ${payments.simulinkpayTransactionId} = ${params.referenceOrExternalId}`
        )
        .limit(1);

      if (!existing) {
        return { found: false as const };
      }

      if (existing.status === 'completed') {
        return { found: true as const, alreadyProcessed: true, payment: existing };
      }

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: params.status,
          simulinkpayTransactionId: params.transactionId ?? existing.simulinkpayTransactionId,
          metadata: params.metadata,
          completedAt: params.status === 'completed' ? new Date() : null,
        })
        .where(eq(payments.id, existing.id))
        .returning();

      if (params.status === 'completed') {
        await tx
          .update(users)
          .set({
            credits: sql`${users.credits} + ${existing.creditsPurchased}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.userId));
      }

      return { found: true as const, alreadyProcessed: false, payment: updatedPayment };
    });
  } catch (error) {
    console.error('Database transaction failed in reconcilePaymentWebhook:', error);
    throw new Error('Failed to reconcile payment webhook.', { cause: error });
  }
}

export async function listUserPayments(userId: number) {
  try {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(50);
  } catch (error) {
    console.error('Database query failed in listUserPayments:', error);
    throw new Error('Failed to load payment history.', { cause: error });
  }
}
