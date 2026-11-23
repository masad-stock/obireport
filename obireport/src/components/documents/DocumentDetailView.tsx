import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Trash2,
} from 'lucide-react';
import {
  exportDocumentPdf,
  fetchDocumentDetail,
  pollDocumentStatus,
} from '../../services/api';
import type { DocumentDetail } from '../../types';
import {
  formatBytes,
  formatDateTime,
  getScoreClassification,
} from '../../utils/formatters';

interface DocumentDetailViewProps {
  documentId: string;
  credits: number;
  onBack: () => void;
  onGoToBilling: () => void;
  onRunProcess: (documentId: string) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; description?: string }) => void;
}

export function DocumentDetailView({
  documentId,
  credits,
  onBack,
  onGoToBilling,
  onRunProcess,
  onDelete,
  onNotify,
}: DocumentDetailViewProps) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passageFilter, setPassageFilter] = useState<string>('all');
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadDetail = async () => {
    try {
      const { document } = await fetchDocumentDetail(documentId);
      setDoc(document);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load report.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadDetail();
  }, [documentId]);

  // Poll automatically while document is processing
  useEffect(() => {
    if (!doc || doc.status !== 'processing') return;

    const timer = window.setInterval(async () => {
      try {
        const statusData = await pollDocumentStatus(doc.id);
        if (statusData.status !== 'processing') {
          await loadDetail();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [doc?.id, doc?.status]);

  const handleExport = async () => {
    if (!doc || exporting) return;
    setExporting(true);
    try {
      await exportDocumentPdf(doc.id, doc.filename);
      onNotify({ type: 'success', title: 'PDF report downloaded' });
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'PDF export failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-36 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
          {error || 'Report not found'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Reports</span>
        </button>
      </div>
    );
  }

  const sim = getScoreClassification(doc.similarityScore);
  const ai = getScoreClassification(doc.aiScore);
  const passages = doc.reportDetails?.flaggedPassages || [];
  const filteredPassages =
    passageFilter === 'all'
      ? passages
      : passages.filter((p) => p.category === passageFilter);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm sm:text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span>Back to Reports</span>
          </button>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
            {doc.filename}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>{doc.fileType.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(doc.fileSize)}</span>
            <span aria-hidden="true">·</span>
            <span>{doc.wordCount.toLocaleString()} words</span>
            <span aria-hidden="true">·</span>
            <span>Submitted {formatDateTime(doc.createdAt)}</span>
            {doc.reportDetails?.engineLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans">{doc.reportDetails.engineLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 shrink-0">
          {(doc.status === 'pending' || doc.status === 'failed') &&
            (credits > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await onRunProcess(doc.id);
                  await loadDetail();
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Run Verification (1 Credit)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToBilling}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Top Up Credits via M-Pesa</span>
              </button>
            ))}

          {doc.status === 'completed' && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating PDF...' : 'Export PDF'}</span>
            </button>
          )}

          {doc.turnitinReportUrl && (
            <a
              href={doc.turnitinReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Turnitin Viewer</span>
            </a>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onDelete(doc.id)}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-900 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Processing / Pending / Failed States */}
      {doc.status === 'processing' && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-blue-700 dark:text-blue-400 animate-spin shrink-0" />
          <div>
            <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Verification in progress
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Analyzing citation overlap, stylometric burstiness, and passage originality. This view
              updates automatically when scoring completes.
            </p>
          </div>
        </div>
      )}

      {doc.status === 'failed' && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-5">
          <p className="font-display text-sm font-semibold text-red-800 dark:text-red-300">
            Verification Error (credit automatically refunded)
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            {doc.errorMessage || 'An unexpected error occurred during processing.'}
          </p>
        </div>
      )}

      {doc.status === 'pending' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Queued for verification
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Text extraction is complete ({doc.wordCount.toLocaleString()} words). Click{' '}
            <strong>Run Verification</strong> above to score similarity and AI writing indicators.
          </p>
        </div>
      )}

      {/* Completed Scores */}
      {doc.status === 'completed' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Similarity Index
                </p>
                <span className={`text-xs font-semibold ${sim.textClass}`}>{sim.label}</span>
              </div>
              <p className="mt-2 font-mono text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                {sim.numeric !== null ? `${sim.numeric.toFixed(1)}%` : '—'}
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${sim.barClass}`}
                  style={{ width: `${Math.min(100, sim.numeric ?? 0)}%` }}
                />
              </div>
              {doc.reportDetails?.similaritySignalsSummary && (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {doc.reportDetails.similaritySignalsSummary}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  AI Writing Indicator
                </p>
                <span className={`text-xs font-semibold ${ai.textClass}`}>{ai.label}</span>
              </div>
              <p className="mt-2 font-mono text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                {ai.numeric !== null ? `${ai.numeric.toFixed(1)}%` : '—'}
              </p>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${ai.barClass}`}
                  style={{ width: `${Math.min(100, ai.numeric ?? 0)}%` }}
                />
              </div>
              {doc.reportDetails?.aiSignalsSummary && (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {doc.reportDetails.aiSignalsSummary}
                </p>
              )}
            </div>
          </div>

          {/* Executive Summary & Verdict */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Executive Verdict
            </h2>
            {doc.reportDetails?.overallVerdict && (
              <p className="mt-1 text-sm font-medium text-blue-700 dark:text-blue-400">
                {doc.reportDetails.overallVerdict}
              </p>
            )}
            {doc.reportSummary && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {doc.reportSummary}
              </p>
            )}
          </div>

          {/* Section Breakdown */}
          {doc.reportDetails?.sectionBreakdown && doc.reportDetails.sectionBreakdown.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Section Breakdown
                </h2>
              </div>

              {/* Mobile Section Cards */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {doc.reportDetails.sectionBreakdown.map((sec, idx) => (
                  <div key={idx} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                        {sec.section}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        Sim {sec.similarityPercent.toFixed(1)}% · AI {sec.aiPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {sec.notes}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-6 font-medium">Section</th>
                      <th className="py-3 px-4 font-medium text-right">Similarity</th>
                      <th className="py-3 px-4 font-medium text-right">AI Likelihood</th>
                      <th className="py-3 px-6 font-medium">Reviewer Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {doc.reportDetails.sectionBreakdown.map((sec, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-6 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {sec.section}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {sec.similarityPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {sec.aiPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-6 text-slate-600 dark:text-slate-300">{sec.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Flagged Passages */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Flagged Passages ({passages.length})
              </h2>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-x-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'ai_pattern', label: 'AI Pattern' },
                  { id: 'similarity_match', label: 'Similarity' },
                  { id: 'citation_gap', label: 'Citation Gap' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPassageFilter(tab.id)}
                    className={`min-h-[38px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      passageFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredPassages.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No passages flagged under this filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredPassages.map((p, idx) => {
                  const categoryLabel =
                    p.category === 'similarity_match'
                      ? 'Similarity Match'
                      : p.category === 'citation_gap'
                        ? 'Citation Gap'
                        : 'AI Stylometry Pattern';
                  const categoryColor =
                    p.category === 'similarity_match'
                      ? 'text-red-700 dark:text-red-400'
                      : p.category === 'citation_gap'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-blue-700 dark:text-blue-400';

                  return (
                    <div key={idx} className="p-6 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={`font-semibold ${categoryColor}`}>
                          {categoryLabel} · {p.sourceHint}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {p.confidence.toFixed(0)}% confidence
                        </span>
                      </div>
                      <blockquote className="text-sm italic text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3">
                        &ldquo;{p.excerpt}&rdquo;
                      </blockquote>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {p.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommendations */}
          {doc.reportDetails?.recommendations && doc.reportDetails.recommendations.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Revision Recommendations
              </h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300 list-decimal list-inside">
                {doc.reportDetails.recommendations.map((rec, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {/* Extracted Text Drawer */}
      {doc.extractedText && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExtractedText((prev) => !prev)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
          >
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Extracted Document Text ({doc.wordCount.toLocaleString()} words)
            </span>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {showExtractedText ? 'Hide text' : 'Show text'}
            </span>
          </button>
          {showExtractedText && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-h-96 overflow-y-auto">
                {doc.extractedText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
