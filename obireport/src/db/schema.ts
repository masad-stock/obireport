import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export interface ReportPassage {
  excerpt: string;
  category: 'ai_pattern' | 'similarity_match' | 'citation_gap';
  confidence: number;
  sourceHint: string;
  explanation: string;
}

export interface ReportDetails {
  engineLabel: string;
  overallVerdict: string;
  aiSignalsSummary: string;
  similaritySignalsSummary: string;
  sectionBreakdown: Array<{
    section: string;
    similarityPercent: number;
    aiPercent: number;
    notes: string;
  }>;
  flaggedPassages: ReportPassage[];
  recommendations: string[];
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  credits: integer('credits').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    filename: text('filename').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    fileType: text('file_type').notNull(),
    wordCount: integer('word_count').notNull().default(0),
    storagePath: text('storage_path').notNull(),
    extractedText: text('extracted_text'),
    status: text('status').notNull().default('pending'),
    engine: text('engine').notNull().default('forensic_ai'),
    similarityScore: numeric('similarity_score', { precision: 5, scale: 2 }),
    aiScore: numeric('ai_score', { precision: 5, scale: 2 }),
    reportSummary: text('report_summary'),
    reportDetails: jsonb('report_details').$type<ReportDetails | null>(),
    turnitinSubmissionId: text('turnitin_submission_id'),
    turnitinReportUrl: text('turnitin_report_url'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('idx_documents_user_id').on(table.userId),
    index('idx_documents_status').on(table.status),
    index('idx_documents_created_at').on(table.createdAt),
  ]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    amountCents: integer('amount_cents').notNull(),
    creditsPurchased: integer('credits_purchased').notNull().default(1),
    currency: text('currency').notNull().default('KES'),
    status: text('status').notNull().default('pending'),
    simulinkpayTransactionId: text('simulinkpay_transaction_id'),
    simulinkpayReference: text('simulinkpay_reference'),
    phoneNumber: text('phone_number'),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('idx_payments_user_id').on(table.userId),
    index('idx_payments_status').on(table.status),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  payments: many(payments),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  author: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [payments.documentId],
    references: [documents.id],
  }),
}));
