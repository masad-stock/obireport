import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Moon, ShieldCheck, Sun } from 'lucide-react';
import type { ThemeMode } from '../../hooks/useTheme';

interface LandingPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const HERO_IMAGE_SRC = '/src/assets/images/kenyan_students_hero_1795432659927.jpg';

const PRICING_TIERS = [
  {
    id: 'single',
    name: 'Single Check',
    audience: 'For individual term papers & cats',
    price: 'KES 150',
    cadence: 'per report',
    savings: 'Pay as you go',
    credits: '1 report credit',
    turnaround: 'Instant processing',
    exportFormat: 'PDF verification report',
    cardClass:
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
    eyebrowClass: 'text-blue-700 dark:text-blue-400',
    mutedClass: 'text-slate-500 dark:text-slate-400',
    dividerClass: 'border-slate-200 dark:border-slate-800',
    buttonClass:
      'bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white',
  },
  {
    id: 'scholar',
    name: 'Scholar 5-Pack',
    audience: 'Most popular · Thesis & project drafts',
    price: 'KES 650',
    cadence: 'KES 130 / report',
    savings: 'Save KES 100',
    credits: '5 report credits',
    turnaround: 'Priority queue',
    exportFormat: 'PDF report + passage breakdown',
    cardClass:
      'bg-emerald-950 dark:bg-emerald-950 border-emerald-800 text-white shadow-lg',
    eyebrowClass: 'text-amber-300',
    mutedClass: 'text-emerald-200/80',
    dividerClass: 'border-emerald-800/80',
    buttonClass: 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-semibold',
  },
  {
    id: 'research',
    name: 'Research 15-Pack',
    audience: 'For study groups & postgraduate labs',
    price: 'KES 1,650',
    cadence: 'KES 110 / report',
    savings: 'Save KES 600',
    credits: '15 report credits',
    turnaround: 'Multi-draft archive',
    exportFormat: 'Full audit PDF exports',
    cardClass:
      'bg-blue-50/80 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900/70 text-slate-900 dark:text-white',
    eyebrowClass: 'text-blue-800 dark:text-blue-300',
    mutedClass: 'text-slate-600 dark:text-slate-300',
    dividerClass: 'border-blue-200/80 dark:border-blue-900/60',
    buttonClass:
      'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white',
  },
];

export function LandingPage({
  theme,
  onToggleTheme,
}: LandingPageProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            ObiReport
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              to="#workflow"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </Link>
            <Link
              to="#scoring"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Scoring
            </Link>
            <Link
              to="#pricing"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </Link>
            <Link
              to="#security"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </Link>
          </nav>

          <div className="shrink-0 flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-6xl mx-auto px-6 pt-12 pb-10 lg:pt-16 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
                  Built for Kenyan University & College Scholars
                </p>
                <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12] text-balance">
                  Verify similarity & AI scores before you submit.
                </h1>
                <p className="mt-5 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  Check your assignments, undergraduate projects, and postgraduate theses for
                  similarity and AI writing markers in seconds. Pay only per check via M-Pesa with
                  zero monthly commitments.
                </p>

                <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Check Your Paper Now</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="#pricing"
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800 sm:border-transparent rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    See KES Rates
                  </Link>
                </div>
              </div>

              <div className="mt-10 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Instant M-Pesa STK Push</span>
                <span aria-hidden="true">·</span>
                <span>No Repository Storage</span>
                <span aria-hidden="true">·</span>
                <span>Downloadable PDF Report</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[320px] lg:min-h-[430px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                {!imgFailed ? (
                  <img
                    src={HERO_IMAGE_SRC}
                    alt="Two Kenyan university students reviewing a research manuscript and laptop in a sunlit Nairobi campus library"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
                    <FileText className="w-10 h-10 text-slate-500 dark:text-slate-400 mb-3" />
                    <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                      ObiReport Verification Workspace
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Similarity index, AI detection breakdown, and PDF report export
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Specification Strip below Hero */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Supported Formats</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                PDF · DOCX · TXT
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Maximum File Size</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                50 MB / upload
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pay-Per-Check Rate</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                From KES 110
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Payment Method</p>
              <p className="mt-1 font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                M-Pesa Instant
              </p>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section
          id="workflow"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-14"
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Submit with confidence across every semester
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Designed for fast pre-submission checks so you can fix citation gaps and flagged
                passages before uploading to your university portal.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  01. Upload Your Manuscript
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Drop your PDF, DOCX, or TXT file up to 50 MB. Word counts and document structure
                  are extracted cleanly in seconds.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  02. Top Up via M-Pesa & Scan
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Buy a single check or bundle right from your phone with M-Pesa STK Push and view
                  both similarity and AI scores side by side.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  03. Revise & Export PDF
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Review highlighted excerpts section by section and download a clean PDF report for
                  your supervisor or personal records.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Scoring Thresholds Section */}
        <section id="scoring" className="border-t border-slate-200 dark:border-slate-800 py-14">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Clear threshold interpretation
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Every percentage is paired with an explicit classification so you know exactly what
                needs attention before final submission.
              </p>
            </div>

            {/* Mobile stacked threshold cards */}
            <div className="mt-8 md:hidden space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    0.0% – 15.0%
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Low Risk
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Consistent with original academic writing and properly attributed citations.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    15.1% – 35.0%
                  </span>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Moderate Review
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Inspect flagged excerpts for missing quotation marks, close paraphrasing, or
                  repetitive transitions.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    35.1% – 100.0%
                  </span>
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                    High Risk
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Substantial overlap or synthetic writing markers detected; rewrite flagged
                  sections before submission.
                </p>
              </div>
            </div>

            {/* Desktop table */}
            <div className="mt-8 hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-5 font-medium">Score Band</th>
                    <th className="py-3.5 px-5 font-medium">Classification</th>
                    <th className="py-3.5 px-5 font-medium">Recommended Editorial Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      0.0% – 15.0%
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-emerald-700 dark:text-emerald-400">
                      Low Risk
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">
                      Consistent with original academic writing and properly attributed citations.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      15.1% – 35.0%
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-amber-700 dark:text-amber-400">
                      Moderate Review
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">
                      Inspect flagged excerpts for missing quotation marks, close paraphrasing, or
                      repetitive transitions.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      35.1% – 100.0%
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-red-700 dark:text-red-400">
                      High Risk
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">
                      Substantial overlap or synthetic writing markers detected; rewrite flagged
                      sections before submission.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Vibrant Pricing Section */}
        <section
          id="pricing"
          className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/70 py-16"
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                Simple KES Pricing · No Subscriptions
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Pay per check via M-Pesa
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Purchase a single report when you need it or save up to 27% with multi-draft packs
                for thesis revisions.
              </p>
            </div>

            <div className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-transform duration-150 ${tier.cardClass}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-xs font-semibold ${tier.eyebrowClass}`}>{tier.savings}</p>
                    </div>
                    <h3 className="mt-2 font-display text-xl font-bold">{tier.name}</h3>
                    <p className={`mt-1 text-xs ${tier.mutedClass}`}>{tier.audience}</p>

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-bold tabular-nums">{tier.price}</span>
                      <span className={`text-xs ${tier.mutedClass}`}>{tier.cadence}</span>
                    </div>

                    <dl className={`mt-6 pt-5 border-t space-y-2.5 text-sm ${tier.dividerClass}`}>
                      <div className="flex justify-between gap-4">
                        <dt className={tier.mutedClass}>Allowance</dt>
                        <dd className="font-medium tabular-nums">{tier.credits}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className={tier.mutedClass}>Turnaround</dt>
                        <dd className="font-medium">{tier.turnaround}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className={tier.mutedClass}>Deliverable</dt>
                        <dd className="font-medium text-right">{tier.exportFormat}</dd>
                      </div>
                    </dl>
                  </div>

                  <Link
                    to="/register"
                    className={`mt-7 w-full min-h-[48px] py-2.5 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tier.buttonClass}`}
                  >
                    Get Started with M-Pesa
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section id="security" className="border-t border-slate-200 dark:border-slate-800 py-14">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Private & Non-Repository Verification</span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Your drafts are never indexed into a shared student database, so checking your paper
                here will never trigger self-plagiarism when you submit to your university. Delete
                any document permanently whenever you choose.
              </p>
            </div>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Open Workspace
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>ObiReport · Similarity & AI Verification for Students</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}