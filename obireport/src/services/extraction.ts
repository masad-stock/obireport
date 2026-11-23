import crypto from 'node:crypto';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';
import { putObject, deleteObject, buildStorageKey } from './storage.ts';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

const CONTENT_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

export interface ExtractedDocument {
  safeOriginalName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  storagePath: string;
  extractedText: string;
  wordCount: number;
}

export function sanitizeFilename(rawName: string): string {
  const base = path.basename(rawName || 'document.txt').replace(/[^\w.\-() ]+/g, '_').trim();
  return base.slice(0, 180) || 'document.txt';
}

export function detectDocumentType(filename: string, mimetype: string): 'pdf' | 'docx' | 'txt' | null {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }

  if (ext === '.pdf' && (mimetype === 'application/pdf' || mimetype === 'application/octet-stream')) {
    return 'pdf';
  }
  if (
    ext === '.docx' &&
    (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/zip' ||
      mimetype === 'application/octet-stream')
  ) {
    return 'docx';
  }
  if (ext === '.txt' && (mimetype.startsWith('text/') || mimetype === 'application/octet-stream')) {
    return 'txt';
  }

  if (!mimetype) {
    return ext.slice(1) as 'pdf' | 'docx' | 'txt';
  }

  return null;
}

export async function saveAndExtractDocument(params: {
  userId: number;
  originalName: string;
  mimetype: string;
  buffer: Buffer;
}): Promise<ExtractedDocument> {
  const safeOriginalName = sanitizeFilename(params.originalName);
  const fileType = detectDocumentType(safeOriginalName, params.mimetype);

  if (!fileType) {
    throw new Error('Unsupported file format. Please upload a PDF, DOCX, or TXT document.');
  }

  if (params.buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  if (params.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('File exceeds the 50 MB size limit.');
  }

  let extractedText = '';
  try {
    if (fileType === 'txt') {
      extractedText = params.buffer.toString('utf8');
    } else if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer: params.buffer });
      extractedText = result.value || '';
    } else if (fileType === 'pdf') {
      const result = await extractPdfText(new Uint8Array(params.buffer), { mergePages: true });
      extractedText = Array.isArray(result.text) ? result.text.join('\n\n') : result.text || '';
    }
  } catch (err) {
    console.warn(`Text extraction warning for ${fileType}:`, err);
    extractedText = '';
  }

  const normalized = extractedText.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

  if ((fileType === 'docx' || fileType === 'txt') && wordCount === 0) {
    throw new Error('No readable text found in the uploaded document.');
  }

  const storageKey = buildStorageKey(params.userId, fileType);
  const contentType = CONTENT_TYPE_MAP[fileType];

  await putObject(storageKey, params.buffer, contentType);

  return {
    safeOriginalName,
    fileType,
    storagePath: storageKey,
    extractedText: normalized.slice(0, 250000),
    wordCount,
  };
}

export async function deleteStoredFile(userId: number, storagePath: string): Promise<void> {
  try {
    await deleteObject(storagePath);
  } catch (err: unknown) {
    console.error('Failed to remove stored document file from R2:', err);
  }
}

export async function getStoredFileBuffer(storagePath: string): Promise<Buffer> {
  const { getObject } = await import('./storage.ts');
  return getObject(storagePath);
}