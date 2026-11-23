import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Download,
  Eye,
  Play,
  Search,
  Trash2,
} from 'lucide-react';
import type { DocumentSummary } from '../../types';
import {
  formatBytes,
  formatShortDate,
  getScoreClassification,
} from '../../utils/formatters';

interface DocumentTableProps {
  documents: DocumentSummary[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  statusFilter: string;
  searchQuery: string;
  scoreRange: 'all' | 'low' | 'moderate' | 'high';
  dateFrom: string;
  dateTo: string;
  sortBy: 'createdAt' | 'similarityScore' | 'aiScore' | 'filename';
  sortDir: 'asc' | 'desc';
  onStatusChange: (status: string) => void;
  onSearchChange: (q: string) => void;
  onScoreRangeChange: (range: 'all' | 'low' | 'moderate' | 'high') => void;
  onDateFromChange: (val: string) => void;
  onDateToChange: (val: string) => void;
  onSortChange: (col: 'createdAt' | 'similarityScore' | 'aiScore' | 'filename') => void;
  onPageChange: (nextPage: number) => void;
  onViewDocument: (id: string) => void;
  onProcessDocument: (id: string) => void;
  onExportDocument: (id: string, filename: string) => void;
  onDeleteDocument: (id: string) => Promise<void>;
  onUploadFirstClick: () => void;
}

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'processing', label: 'Processing' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
];

export function DocumentTable({
  documents,
  loading,
  page,
  totalPages,
  total,
  statusFilter,
  searchQuery,
  scoreRange,
  dateFrom,
  dateTo,
  sortBy,
  sortDir,
  onStatusChange,
  onSearchChange,
  onScoreRangeChange,
  onDateFromChange,
  onDateToChange,
  onSortChange,
  onPageChange,
  onViewDocument,
  onProcessDocument,
  onExportDocument,
  onDeleteDocument,
  onUploadFirstClick,
}: DocumentTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const renderSortIcon = (col: 'createdAt' | 'similarityScore' | 'aiScore' | 'filename') => {
    if (sortBy !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-45" aria-hidden="true" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    );
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteDocument(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const renderStatusText = (status: string) => {
    if (status === 'completed') {
      return <span className="font-medium text-emerald-700 dark:text-emerald-400">Completed</span>;
    }
    if (status === 'processing') {
      return <span className="font-medium text-blue-700 dark:text-blue-400">Processing</span>;
    }
    if (status === 'failed') {
      return <span className="font-medium text-red-700 dark:text-red-400">Failed</span>;
    }
    return <span className="font-medium text-slate-600 dark:text-slate-400">Pending</span>;
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search filename..."
              aria-label="Search documents by filename"
              className="w-full min-h-[44px] sm:min-h-[38px] pl-9 pr-3 py-1.5 text-base sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <label htmlFor="score-range-filter" className="text-slate-500 dark:text-slate-400 shrink-0">
              Similarity Band
            </label>
            <select
              id="score-range-filter"
              value={scoreRange}
              onChange={(e) =>
                onScoreRangeChange(e.target.value as 'all' | 'low' | 'moderate' | 'high')
              }
              className="min-h-[40px] sm:min-h-0 px-2.5 py-1.5 text-sm sm:text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Scores</option>
              <option value="low">Low (0–15%)</option>
              <option value="moderate">Moderate (16–35%)</option>
              <option value="high">High (&gt;35%)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="date-from-filter" className="text-slate-500 dark:text-slate-400">
                From
              </label>
              <input
                id="date-from-filter"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full min-h-[40px] sm:min-h-0 px-2 py-1.5 text-sm sm:text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="date-to-filter" className="text-slate-500 dark:text-slate-400">
                To
              </label>
              <input
                id="date-to-filter"
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full min-h-[40px] sm:min-h-0 px-2 py-1.5 text-sm sm:text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          {(statusFilter !== 'all' ||
            searchQuery ||
            scoreRange !== 'all' ||
            dateFrom ||
            dateTo) && (
            <button
              type="button"
              onClick={() => {
                onStatusChange('all');
                onSearchChange('');
                onScoreRangeChange('all');
                onDateFromChange('');
                onDateToChange('');
              }}
              className="sm:ml-auto min-h-[40px] sm:min-h-0 text-left sm:text-right text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile Touch Card List */}
      <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="p-4 space-y-2.5">
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          ))
        ) : documents.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
              No matching reports
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Uploaded manuscripts and completed similarity checks will appear here.
            </p>
            <button
              type="button"
              onClick={onUploadFirstClick}
              className="mt-4 w-full min-h-[48px] px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          documents.map((doc) => {
            const sim = getScoreClassification(doc.similarityScore);
            const ai = getScoreClassification(doc.aiScore);
            const isConfirmingDelete = confirmDeleteId === doc.id;

            return (
              <div key={doc.id} className="p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => onViewDocument(doc.id)}
                  className="w-full text-left flex items-start justify-between gap-3 min-h-[44px] cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                      {doc.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSize)} ·{' '}
                      {formatShortDate(doc.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>{renderStatusText(doc.status)}</span>
                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <span>
                      Sim:{' '}
                      <strong className={sim.textClass}>
                        {sim.numeric !== null ? `${sim.numeric.toFixed(1)}%` : '—'}
                      </strong>
                    </span>
                    <span>
                      AI:{' '}
                      <strong className={ai.textClass}>
                        {ai.numeric !== null ? `${ai.numeric.toFixed(1)}%` : '—'}
                      </strong>
                    </span>
                  </div>
                </div>

                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleConfirmDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="flex-1 min-h-[44px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      {deletingId === doc.id ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[44px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onViewDocument(doc.id)}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Report</span>
                    </button>

                    {(doc.status === 'pending' || doc.status === 'failed') && (
                      <button
                        type="button"
                        onClick={() => onProcessDocument(doc.id)}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 text-white text-xs font-medium cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Run Check</span>
                      </button>
                    )}

                    {doc.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => onExportDocument(doc.id, doc.filename)}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>PDF</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(doc.id)}
                      aria-label={`Delete ${doc.filename}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-700 dark:text-slate-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 font-medium">
                <button
                  type="button"
                  onClick={() => onSortChange('filename')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span>Manuscript</span>
                  {renderSortIcon('filename')}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">
                <button
                  type="button"
                  onClick={() => onSortChange('similarityScore')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span>Similarity</span>
                  {renderSortIcon('similarityScore')}
                </button>
              </th>
              <th className="py-3 px-4 font-medium text-right">
                <button
                  type="button"
                  onClick={() => onSortChange('aiScore')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span>AI Score</span>
                  {renderSortIcon('aiScore')}
                </button>
              </th>
              <th className="py-3 px-4 font-medium text-right">Words</th>
              <th className="py-3 px-4 font-medium text-right">
                <button
                  type="button"
                  onClick={() => onSortChange('createdAt')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span>Submitted</span>
                  {renderSortIcon('createdAt')}
                </button>
              </th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="h-11">
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-14 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-14 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-12 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 px-6 text-center">
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    No matching reports
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Uploaded manuscripts and completed similarity checks will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={onUploadFirstClick}
                    className="mt-4 min-h-[44px] px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    Upload First Document
                  </button>
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const sim = getScoreClassification(doc.similarityScore);
                const ai = getScoreClassification(doc.aiScore);
                const isConfirmingDelete = confirmDeleteId === doc.id;

                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 max-w-[260px]">
                      <button
                        type="button"
                        onClick={() => onViewDocument(doc.id)}
                        className="text-left group cursor-pointer w-full"
                      >
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSize)}
                        </p>
                      </button>
                    </td>

                    <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                      {renderStatusText(doc.status)}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {sim.numeric !== null ? (
                        <div>
                          <span className={`font-semibold ${sim.textClass}`}>
                            {sim.numeric.toFixed(1)}%
                          </span>
                          <span className="block text-[11px] font-sans text-slate-500 dark:text-slate-400">
                            {sim.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {ai.numeric !== null ? (
                        <div>
                          <span className={`font-semibold ${ai.textClass}`}>
                            {ai.numeric.toFixed(1)}%
                          </span>
                          <span className="block text-[11px] font-sans text-slate-500 dark:text-slate-400">
                            {ai.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {doc.wordCount.toLocaleString()}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatShortDate(doc.createdAt)}
                    </td>

                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleConfirmDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer"
                          >
                            {deletingId === doc.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewDocument(doc.id)}
                            title="View report"
                            aria-label={`View report for ${doc.filename}`}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(doc.status === 'pending' || doc.status === 'failed') && (
                            <button
                              type="button"
                              onClick={() => onProcessDocument(doc.id)}
                              title="Run verification check"
                              aria-label={`Run verification for ${doc.filename}`}
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-400 cursor-pointer"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {doc.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => onExportDocument(doc.id, doc.filename)}
                              title="Export PDF report"
                              aria-label={`Export PDF for ${doc.filename}`}
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            title="Delete document"
                            aria-label={`Delete ${doc.filename}`}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-mono tabular-nums">
          {total} {total === 1 ? 'doc' : 'docs'} · {page}/{totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="min-h-[44px] sm:min-h-[36px] px-4 sm:px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="min-h-[44px] sm:min-h-[36px] px-4 sm:px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
