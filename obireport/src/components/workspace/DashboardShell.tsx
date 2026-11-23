import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { ThemeMode } from '../../hooks/useTheme';
import {
  deleteDocumentById,
  exportDocumentPdf,
  fetchDocuments,
  processDocument,
} from '../../services/api';
import type { DocumentSummary, ToastItem } from '../../types';
import { DocumentDetailView } from '../documents/DocumentDetailView';
import { DocumentTable } from '../documents/DocumentTable';
import { UploadDropzone } from '../documents/UploadDropzone';
import { BillingView } from '../payments/BillingView';
import { SettingsView } from './SettingsView';

type ActiveSection = 'overview' | 'upload' | 'reports' | 'billing' | 'settings';

interface DashboardShellProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNotify: (toast: Omit<ToastItem, 'id'>) => void;
}

export function DashboardShell({ theme, onToggleTheme, onNotify }: DashboardShellProps) {
  const { profile, stats, integrations, logout, refreshProfile } = useAuth();
  const [section, setSection] = useState<ActiveSection>('overview');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Document list state
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreRange, setScoreRange] = useState<'all' | 'low' | 'moderate' | 'high'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'similarityScore' | 'aiScore' | 'filename'>(
    'createdAt'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetchDocuments({
        page,
        limit: 10,
        status: statusFilter,
        search: searchQuery,
        scoreRange,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
      });
      setDocuments(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Unable to load reports',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoadingDocs(false);
    }
  }, [page, statusFilter, searchQuery, scoreRange, dateFrom, dateTo, sortBy, sortDir, onNotify]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Background refresh when any listed document is currently processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing');
    if (!hasProcessing) return;

    const timer = window.setInterval(() => {
      void loadDocuments();
      void refreshProfile();
    }, 3500);
    return () => window.clearInterval(timer);
  }, [documents, loadDocuments, refreshProfile]);

  const handleSortChange = (col: 'createdAt' | 'similarityScore' | 'aiScore' | 'filename') => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleRunProcess = async (docId: string) => {
    try {
      await processDocument(docId);
      onNotify({
        type: 'info',
        title: 'Verification started',
        description: 'Scoring similarity and AI stylometry signals.',
      });
      await Promise.all([loadDocuments(), refreshProfile()]);
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Could not start verification',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleExport = async (docId: string, filename: string) => {
    try {
      await exportDocumentPdf(docId, filename);
      onNotify({ type: 'success', title: 'PDF certificate downloaded' });
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'PDF export failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocumentById(docId);
      onNotify({ type: 'success', title: 'Document deleted' });
      if (selectedDocumentId === docId) {
        setSelectedDocumentId(null);
      }
      await Promise.all([loadDocuments(), refreshProfile()]);
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    shortLabel: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
    { id: 'upload', label: 'New Check', shortLabel: 'Check', icon: Plus },
    { id: 'reports', label: 'All Reports', shortLabel: 'Reports', icon: FileText },
    { id: 'billing', label: 'Billing & Credits', shortLabel: 'M-Pesa', icon: CreditCard },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  ];

  const navigateTo = (target: ActiveSection) => {
    setSection(target);
    setSelectedDocumentId(null);
    setMobileMenuOpen(false);
  };

  const breadcrumbLabel = selectedDocumentId
    ? 'Report Detail'
    : navItems.find((n) => n.id === section)?.label || 'Overview';

  const SidebarContent = (
    <div className="flex flex-col h-full justify-between p-4">
      <div>
        <div className="px-2 py-2 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            ObiReport
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Workspace navigation" className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id && !selectedDocumentId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-400">Credits</span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {profile?.credits ?? 0}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
        >
          <span>Appearance</span>
          <span className="inline-flex items-center gap-1.5">
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dark</span>
              </>
            )}
          </span>
        </button>

        <div className="px-3 py-2">
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            {profile?.fullName || profile?.email}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{profile?.email}</p>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 lg:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="hidden sm:inline-flex lg:hidden min-h-[40px] min-w-[40px] items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-display font-bold lg:font-sans lg:font-normal text-slate-900 lg:text-slate-500 dark:text-white lg:dark:text-slate-400">
                ObiReport
              </span>
              <span className="text-slate-400" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {breadcrumbLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('billing')}
              className="min-h-[36px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap cursor-pointer"
            >
              {profile?.credits ?? 0} cr
            </button>
            <button
              type="button"
              onClick={() => navigateTo('upload')}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Check</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6">
          {selectedDocumentId ? (
            <DocumentDetailView
              documentId={selectedDocumentId}
              credits={profile?.credits ?? 0}
              onBack={() => {
                setSelectedDocumentId(null);
                void loadDocuments();
              }}
              onGoToBilling={() => navigateTo('billing')}
              onRunProcess={handleRunProcess}
              onDelete={handleDelete}
              onNotify={onNotify}
            />
          ) : section === 'settings' ? (
            <SettingsView
              profile={profile}
              integrations={integrations}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onRefreshProfile={refreshProfile}
              onLogout={logout}
              onNotify={onNotify}
            />
          ) : section === 'billing' ? (
            <BillingView
              credits={profile?.credits ?? 0}
              simulinkpayConfigured={integrations.simulinkpayConfigured}
              onRefreshProfile={refreshProfile}
              onNotify={onNotify}
            />
          ) : section === 'upload' ? (
            <UploadDropzone
              credits={profile?.credits ?? 0}
              onUploaded={(res) => {
                onNotify({
                  type: res.processingStarted ? 'info' : 'success',
                  title: res.processingStarted
                    ? 'Manuscript uploaded & verification running'
                    : 'Manuscript saved to queue',
                  description: res.message,
                });
                void refreshProfile();
                void loadDocuments();
                setSelectedDocumentId(res.document.id);
              }}
              onError={(msg) => onNotify({ type: 'error', title: 'Upload error', description: msg })}
              onGoToBilling={() => navigateTo('billing')}
            />
          ) : section === 'reports' ? (
            <DocumentTable
              documents={documents}
              loading={loadingDocs}
              page={page}
              totalPages={totalPages}
              total={total}
              statusFilter={statusFilter}
              searchQuery={searchQuery}
              scoreRange={scoreRange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              sortBy={sortBy}
              sortDir={sortDir}
              onStatusChange={(s) => {
                setStatusFilter(s);
                setPage(1);
              }}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setPage(1);
              }}
              onScoreRangeChange={(r) => {
                setScoreRange(r);
                setPage(1);
              }}
              onDateFromChange={(v) => {
                setDateFrom(v);
                setPage(1);
              }}
              onDateToChange={(v) => {
                setDateTo(v);
                setPage(1);
              }}
              onSortChange={handleSortChange}
              onPageChange={setPage}
              onViewDocument={(id) => setSelectedDocumentId(id)}
              onProcessDocument={(id) => void handleRunProcess(id)}
              onExportDocument={(id, name) => void handleExport(id, name)}
              onDeleteDocument={handleDelete}
              onUploadFirstClick={() => navigateTo('upload')}
            />
          ) : (
            /* Overview Section */
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                <div className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Available Credits</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {profile?.credits ?? 0}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Completed Reports</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.completedDocuments} / {stats.totalDocuments}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg. Similarity</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.avgSimilarity !== null ? `${stats.avgSimilarity.toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg. AI Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.avgAi !== null ? `${stats.avgAi.toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>

              <UploadDropzone
                credits={profile?.credits ?? 0}
                onUploaded={(res) => {
                  onNotify({
                    type: res.processingStarted ? 'info' : 'success',
                    title: res.processingStarted
                      ? 'Manuscript uploaded & verification running'
                      : 'Manuscript saved to queue',
                    description: res.message,
                  });
                  void refreshProfile();
                  void loadDocuments();
                  setSelectedDocumentId(res.document.id);
                }}
                onError={(msg) =>
                  onNotify({ type: 'error', title: 'Upload error', description: msg })
                }
                onGoToBilling={() => navigateTo('billing')}
              />

              <DocumentTable
                documents={documents}
                loading={loadingDocs}
                page={page}
                totalPages={totalPages}
                total={total}
                statusFilter={statusFilter}
                searchQuery={searchQuery}
                scoreRange={scoreRange}
                dateFrom={dateFrom}
                dateTo={dateTo}
                sortBy={sortBy}
                sortDir={sortDir}
                onStatusChange={(s) => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  setPage(1);
                }}
                onScoreRangeChange={(r) => {
                  setScoreRange(r);
                  setPage(1);
                }}
                onDateFromChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                onDateToChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                onSortChange={handleSortChange}
                onPageChange={setPage}
                onViewDocument={(id) => setSelectedDocumentId(id)}
                onProcessDocument={(id) => void handleRunProcess(id)}
                onExportDocument={(id, name) => void handleExport(id, name)}
                onDeleteDocument={handleDelete}
                onUploadFirstClick={() => navigateTo('upload')}
              />
            </>
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 items-center h-[58px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id && !selectedDocumentId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-medium tracking-tight leading-none">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
