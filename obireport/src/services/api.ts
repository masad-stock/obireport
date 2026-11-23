import { auth } from '../lib/firebase';
import type {
  CreditPackage,
  DashboardStats,
  DocumentDetail,
  DocumentListResponse,
  DocumentStatus,
  IntegrationsStatus,
  PaymentRecord,
  UserProfile,
} from '../types';

async function getBearerHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getBearerHeaders();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function fetchAuthMe(): Promise<{
  user: UserProfile;
  stats: DashboardStats;
  integrations: IntegrationsStatus;
}> {
  return requestJson('/api/auth/me');
}

export async function updateProfileName(fullName: string): Promise<{ user: UserProfile }> {
  return requestJson('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName }),
  });
}

export interface DocumentQueryParams {
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

export async function fetchDocuments(params: DocumentQueryParams): Promise<DocumentListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.scoreRange && params.scoreRange !== 'all') {
    searchParams.set('scoreRange', params.scoreRange);
  }
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortDir) searchParams.set('sortDir', params.sortDir);

  return requestJson(`/api/documents?${searchParams.toString()}`);
}

export async function uploadDocumentWithProgress(params: {
  file: File;
  autoProcess: boolean;
  onProgress: (percent: number) => void;
}): Promise<{
  document: DocumentDetail;
  processingStarted: boolean;
  requiresCredits?: boolean;
  remainingCredits?: number;
  message?: string;
}> {
  const authHeaders = await getBearerHeaders();
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('autoProcess', String(params.autoProcess));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents/upload', true);
    xhr.setRequestHeader('Authorization', authHeaders.Authorization);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(
          body as {
            document: DocumentDetail;
            processingStarted: boolean;
            requiresCredits?: boolean;
            remainingCredits?: number;
            message?: string;
          }
        );
      } else {
        reject(new Error((typeof body.error === 'string' && body.error) || 'Upload failed.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload.'));
    };

    xhr.send(formData);
  });
}

export async function processDocument(documentId: string): Promise<{
  document: DocumentDetail;
  processingStarted: boolean;
  remainingCredits?: number;
}> {
  return requestJson(`/api/documents/${documentId}/process`, {
    method: 'POST',
  });
}

export async function fetchDocumentDetail(documentId: string): Promise<{ document: DocumentDetail }> {
  return requestJson(`/api/documents/${documentId}`);
}

export async function pollDocumentStatus(documentId: string): Promise<{
  id: string;
  status: DocumentStatus;
  similarityScore: string | null;
  aiScore: string | null;
  errorMessage: string | null;
  completedAt: string | null;
}> {
  return requestJson(`/api/documents/${documentId}/status`);
}

export async function deleteDocumentById(documentId: string): Promise<{ deletedId: string }> {
  return requestJson(`/api/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export async function exportDocumentPdf(documentId: string, filename: string): Promise<void> {
  const authHeaders = await getBearerHeaders();
  const response = await fetch(`/api/documents/${documentId}/export`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || 'Failed to export PDF report.');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const cleanName = filename.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_');
  anchor.href = objectUrl;
  anchor.download = `${cleanName}_ObiReport.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchPaymentPackages(): Promise<{
  packages: CreditPackage[];
  simulinkpayConfigured: boolean;
}> {
  return requestJson('/api/payments/packages');
}

export async function fetchPaymentHistory(): Promise<{ payments: PaymentRecord[] }> {
  return requestJson('/api/payments/history');
}

export async function initiateStkPayment(payload: {
  packageId: string;
  phoneNumber: string;
  documentId?: string;
}): Promise<{ payment: PaymentRecord; message: string }> {
  return requestJson('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
