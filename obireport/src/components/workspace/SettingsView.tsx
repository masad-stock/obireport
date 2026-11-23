import { useState, type FormEvent } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../../hooks/useTheme';
import { updateProfileName } from '../../services/api';
import type { IntegrationsStatus, UserProfile } from '../../types';
import { formatShortDate } from '../../utils/formatters';

interface SettingsViewProps {
  profile: UserProfile | null;
  integrations: IntegrationsStatus;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onRefreshProfile: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; description?: string }) => void;
}

export function SettingsView({
  profile,
  integrations,
  theme,
  onToggleTheme,
  onRefreshProfile,
  onLogout,
  onNotify,
}: SettingsViewProps) {
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updateProfileName(fullName.trim());
      await onRefreshProfile();
      onNotify({ type: 'success', title: 'Profile updated' });
    } catch (err) {
      onNotify({
        type: 'error',
        title: 'Unable to update profile',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Scholar Profile
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Update the display name shown on your workspace and exported verification reports.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="settings-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Google Account Email
            </label>
            <input
              id="settings-email"
              type="email"
              disabled
              value={profile?.email || ''}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-base sm:text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="settings-fullname"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Full Name
            </label>
            <input
              id="settings-fullname"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Member since {formatShortDate(profile?.createdAt)}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Interface Theme
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Switch between paper-light and dark reading modes across all reports.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4" aria-hidden="true" />
              <span>Switch to Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" aria-hidden="true" />
              <span>Switch to Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Verification &amp; Payment Services
        </h2>
        <dl className="mt-4 divide-y divide-slate-200 dark:divide-slate-800 text-sm">
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-slate-600 dark:text-slate-400">Document Analysis Pipeline</dt>
            <dd className="font-medium text-emerald-700 dark:text-emerald-400 text-right">
              {integrations.turnitinConfigured ? 'Turnitin Core Connected' : 'Forensic Engine Ready'}
            </dd>
          </div>
          <div className="py-3 flex items-center justify-between gap-4">
            <dt className="text-slate-600 dark:text-slate-400">M-Pesa STK Push Checkout</dt>
            <dd
              className={`font-medium text-right ${
                integrations.simulinkpayConfigured
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {integrations.simulinkpayConfigured ? 'Connected' : 'Pending Gateway Keys'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Session
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign out of your ObiReport account on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium text-red-700 dark:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
