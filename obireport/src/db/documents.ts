import { and, asc, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import { db } from './index.ts';
import { documents, users, type ReportDetails } from './schema.ts';

export interface DocumentListFilter {
  userId: number;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  scoreRange?: 'all' | 'low' | 'moderate' | 'high';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'similarityScore' | 'aiScore' | 'filename';
  sortDir?: 'asc' | 'desc';
}

export async function createPendingDocument(input: {
  userId: number;
  filename: string;
  fileSize: number;
  fileType: string;
  wordCount: number;
  storagePath: string;
  extractedText: string;
}) {
  try {
    const [created] = await db
      .insert(documents)
      .values({
        userId: input.userId,
        filename: input.filename,
        fileSize: input.fileSize,
        fileType: input.fileType,
        wordCount: input.wordCount,
        storagePath: input.storagePath,
        extractedText: input.extractedText,
        status: 'pending',
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createPendingDocument:', error);
    throw new Error('Failed to save uploaded document.', { cause: error });
  }
}

export async function listUserDocuments(filter: DocumentListFilter) {
  try {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(50, Math.max(1, filter.limit ?? 10));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(documents.userId, filter.userId)];

    if (filter.status && filter.status !== 'all') {
      conditions.push(eq(documents.status, filter.status));
    }

    if (filter.search && filter.search.trim()) {
      conditions.push(ilike(documents.filename, `%${filter.search.trim()}%`));
    }

    if (filter.scoreRange === 'low') {
      conditions.push(lte(documents.similarityScore, '15'));
    } else if (filter.scoreRange === 'moderate') {
      conditions.push(gte(documents.similarityScore, '15.01'));
      conditions.push(lte(documents.similarityScore, '35'));
    } else if (filter.scoreRange === 'high') {
      conditions.push(gte(documents.similarityScore, '35.01'));
    }

    if (filter.dateFrom) {
      const fromDate = new Date(filter.dateFrom);
      if (!Number.isNaN(fromDate.getTime())) {
        conditions.push(gte(documents.createdAt, fromDate));
      }
    }

    if (filter.dateTo) {
      const toDate = new Date(filter.dateTo);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(documents.createdAt, toDate));
      }
    }

    const whereClause = and(...conditions);

    const sortColumn =
      filter.sortBy === 'similarityScore'
        ? documents.similarityScore
        : filter.sortBy === 'aiScore'
          ? documents.aiScore
          : filter.sortBy === 'filename'
            ? documents.filename
            : documents.createdAt;

    const orderByExpr =
      filter.sortBy === 'similarityScore' || filter.sortBy === 'aiScore'
        ? filter.sortDir === 'asc'
          ? sql`${sortColumn} ASC NULLS LAST`
          : sql`${sortColumn} DESC NULLS LAST`
        : filter.sortDir === 'asc'
          ? asc(sortColumn)
          : desc(sortColumn);

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: documents.id,
          userId: documents.userId,
          filename: documents.filename,
          fileSize: documents.fileSize,
          fileType: documents.fileType,
          wordCount: documents.wordCount,
          status: documents.status,
          engine: documents.engine,
          similarityScore: documents.similarityScore,
          aiScore: documents.aiScore,
          reportSummary: documents.reportSummary,
          errorMessage: documents.errorMessage,
          createdAt: documents.createdAt,
          completedAt: documents.completedAt,
        })
        .from(documents)
        .where(whereClause)
        .orderBy(orderByExpr)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(whereClause),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (error) {
    console.error('Database query failed in listUserDocuments:', error);
    throw new Error('Failed to load documents.', { cause: error });
  }
}

export async function getUserDocumentById(userId: number, documentId: string) {
  try {
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserDocumentById:', error);
    throw new Error('Failed to load document report.', { cause: error });
  }
}

export async function reserveCreditAndStartProcessing(userId: number, documentId: string) {
  try {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1);

      if (!doc) {
        return { kind: 'not_found' as const };
      }

      if (doc.status === 'processing') {
        return { kind: 'already_processing' as const, document: doc };
      }

      const [updatedUser] = await tx
        .update(users)
        .set({
          credits: sql`${users.credits} - 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), gte(users.credits, 1)))
        .returning({ credits: users.credits });

      if (!updatedUser) {
        return { kind: 'insufficient_credits' as const };
      }

      const [updatedDoc] = await tx
        .update(documents)
        .set({
          status: 'processing',
          errorMessage: null,
        })
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .returning();

      return {
        kind: 'started' as const,
        document: updatedDoc,
        remainingCredits: updatedUser.credits,
      };
    });
  } catch (error) {
    console.error('Database transaction failed in reserveCreditAndStartProcessing:', error);
    throw new Error('Failed to initiate document verification.', { cause: error });
  }
}

export async function markDocumentCompleted(params: {
  documentId: string;
  userId: number;
  engine: 'turnitin_api' | 'forensic_ai';
  similarityScore: number;
  aiScore: number;
  reportSummary: string;
  reportDetails: ReportDetails;
  turnitinSubmissionId?: string | null;
  turnitinReportUrl?: string | null;
}) {
  try {
    const [updated] = await db
      .update(documents)
      .set({
        status: 'completed',
        engine: params.engine,
        similarityScore: params.similarityScore.toFixed(2),
        aiScore: params.aiScore.toFixed(2),
        reportSummary: params.reportSummary,
        reportDetails: params.reportDetails,
        turnitinSubmissionId: params.turnitinSubmissionId ?? null,
        turnitinReportUrl: params.turnitinReportUrl ?? null,
        errorMessage: null,
        completedAt: new Date(),
      })
      .where(and(eq(documents.id, params.documentId), eq(documents.userId, params.userId)))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in markDocumentCompleted:', error);
    throw new Error('Failed to save completed report.', { cause: error });
  }
}

export async function markDocumentFailedAndRefundCredit(
  userId: number,
  documentId: string,
  errorMessage: string
) {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({
          status: 'failed',
          errorMessage: errorMessage.slice(0, 500),
        })
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

      await tx
        .update(users)
        .set({
          credits: sql`${users.credits} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });
  } catch (error) {
    console.error('Database transaction failed in markDocumentFailedAndRefundCredit:', error);
  }
}

export async function deleteUserDocument(userId: number, documentId: string) {
  try {
    const [deleted] = await db
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning();
    return deleted ?? null;
  } catch (error) {
    console.error('Database query failed in deleteUserDocument:', error);
    throw new Error('Failed to delete document.', { cause: error });
  }
}

export async function getUserDashboardStats(userId: number) {
  try {
    const [agg] = await db
      .select({
        totalDocuments: sql<number>`count(*)::int`,
        completedDocuments: sql<number>`count(*) filter (where ${documents.status} = 'completed')::int`,
        avgSimilarity: sql<string | null>`round(avg(${documents.similarityScore}), 1)::text`,
        avgAi: sql<string | null>`round(avg(${documents.aiScore}), 1)::text`,
      })
      .from(documents)
      .where(eq(documents.userId, userId));

    return {
      totalDocuments: agg?.totalDocuments ?? 0,
      completedDocuments: agg?.completedDocuments ?? 0,
      avgSimilarity: agg?.avgSimilarity ? Number(agg.avgSimilarity) : null,
      avgAi: agg?.avgAi ? Number(agg.avgAi) : null,
    };
  } catch (error) {
    console.error('Database query failed in getUserDashboardStats:', error);
    throw new Error('Failed to retrieve dashboard metrics.', { cause: error });
  }
}
