import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { uploadDocumentWithProgress } from '../../services/api';
import type { DocumentDetail } from '../../types';
import { formatBytes } from '../../utils/formatters';

interface UploadDropzoneProps {
  credits: number;
  onUploaded: (result: {
    document: DocumentDetail;
    processingStarted: boolean;
    requiresCredits?: boolean;
    message?: string;
  }) => void;
  onError: (message: string) => void;
  onGoToBilling: () => void;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_EXTS = ['.pdf', '.docx', '.txt'];

export function UploadDropzone({
  credits,
  onUploaded,
  onError,
  onGoToBilling,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoProcess, setAutoProcess] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateAndSelect = (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const hasValidExt = ACCEPTED_EXTS.some((ext) => lower.endsWith(ext));
    if (!hasValidExt) {
      onError('Unsupported format. Upload a .pdf, .docx, or .txt document.');
      return;
    }
    if (file.size === 0) {
      onError('Selected file is empty.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      onError('File exceeds the 50 MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    validateAndSelect(e.dataTransfer.files?.[0]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndSelect(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setProgress(0);

    try {
      const shouldProcess = autoProcess && credits > 0;
      const result = await uploadDocumentWithProgress({
        file: selectedFile,
        autoProcess: shouldProcess,
        onProgress: setProgress,
      });
      setSelectedFile(null);
      setProgress(0);
      onUploaded(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Document upload failed.';
      onError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Submit Manuscript for Verification
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            PDF, DOCX, or TXT up to 50 MB · 1 credit per completed check
          </p>
        </div>
        {credits <= 0 && (
          <button
            type="button"
            onClick={onGoToBilling}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Buy Report Credits via M-Pesa
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed transition-colors p-5 sm:p-8 text-center ${
          dragging
            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="flex flex-col items-center">
            <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-3" aria-hidden="true" />
            <p className="hidden sm:block text-sm font-medium text-slate-800 dark:text-slate-200">
              Drag and drop your manuscript here, or select a file below
            </p>
            <p className="sm:hidden text-sm font-medium text-slate-800 dark:text-slate-200">
              Tap below to pick a document from your phone
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Choose File (PDF, DOCX, TXT)
            </button>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Supports academic papers, theses, essays, and drafts up to 50 MB
            </p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  aria-label="Remove selected file"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {uploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5">
                  <span>Uploading and extracting text...</span>
                  <span className="font-mono tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-700 dark:bg-blue-500 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <label className="inline-flex items-center gap-2.5 min-h-[44px] text-xs text-slate-700 dark:text-slate-300 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                  disabled={uploading || credits <= 0}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  {credits > 0
                    ? 'Run verification immediately (uses 1 credit)'
                    : 'Save to queue (0 credits available)'}
                </span>
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={uploading}
                className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
              >
                {uploading
                  ? 'Uploading...'
                  : autoProcess && credits > 0
                    ? 'Upload & Verify'
                    : 'Upload to Queue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
