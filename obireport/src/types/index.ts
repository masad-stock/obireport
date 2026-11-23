export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  credits: number;
  createdAt: string;
}

export interface DashboardStats {
  totalDocuments: number;
  completedDocuments: number;
  avgSimilarity: number | null;
  avgAi: number | null;
}

export interface IntegrationsStatus {
  turnitinConfigured: boolean;
  simulinkpayConfigured: boolean;
}

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

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentSummary {
  id: string;
  userId: number;
  filename: string;
  fileSize: number;
  fileType: string;
  wordCount: number;
  status: DocumentStatus;
  engine: string;
  similarityScore: string | null;
  aiScore: string | null;
  reportSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  extractedText: string | null;
  reportDetails: ReportDetails | null;
  turnitinSubmissionId: string | null;
  turnitinReportUrl: string | null;
}

export interface DocumentListResponse {
  items: DocumentSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export interface PaymentRecord {
  id: string;
  userId: number;
  documentId: string | null;
  amountCents: number;
  creditsPurchased: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  simulinkpayTransactionId: string | null;
  simulinkpayReference: string | null;
  phoneNumber: string | null;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
