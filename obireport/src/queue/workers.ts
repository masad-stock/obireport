import { markDocumentCompleted, markDocumentFailedAndRefundCredit } from '../db/documents.ts';
import { analyzeDocumentContent } from '../services/analyzer.ts';

export async function processDocumentJob(data: {
  userId: number;
  documentId: string;
  filename: string;
  fileType: string;
  storagePath: string;
  extractedText: string;
}): Promise<{ success: boolean; documentId: string }> {
  const { userId, documentId, filename, fileType, storagePath, extractedText } = data;

  try {
    const result = await analyzeDocumentContent({
      userId,
      filename,
      fileType,
      storagePath,
      extractedText,
    });

    await markDocumentCompleted({
      documentId,
      userId,
      engine: result.engine,
      similarityScore: result.similarityScore,
      aiScore: result.aiScore,
      reportSummary: result.reportSummary,
      reportDetails: result.reportDetails,
      turnitinSubmissionId: result.turnitinSubmissionId,
      turnitinReportUrl: result.turnitinReportUrl,
    });

    return { success: true, documentId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Document verification failed.';
    console.error(`Analysis failed for document ${documentId}:`, error);
    await markDocumentFailedAndRefundCredit(userId, documentId, msg);
    throw error;
  }
}