export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** idx;
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function formatShortDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatKes(amountCents: number): string {
  const kes = amountCents / 100;
  return `KES ${kes.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export function formatAuthError(authError: { code?: string; message?: string }): string {
  const code = authError?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    default:
      return authError?.message || 'Authentication failed.';
  }
}

export function getScoreClassification(rawScore: string | number | null | undefined): {
  label: string;
  textClass: string;
  barClass: string;
  numeric: number | null;
} {
  if (rawScore === null || rawScore === undefined || rawScore === '') {
    return {
      label: 'Unscored',
      textClass: 'text-slate-500 dark:text-slate-400',
      barClass: 'bg-slate-300 dark:bg-slate-700',
      numeric: null,
    };
  }

  const num = Number(rawScore);
  if (Number.isNaN(num)) {
    return {
      label: 'Unscored',
      textClass: 'text-slate-500 dark:text-slate-400',
      barClass: 'bg-slate-300 dark:bg-slate-700',
      numeric: null,
    };
  }

  if (num <= 15) {
    return {
      label: 'Low Risk',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      barClass: 'bg-emerald-600 dark:bg-emerald-500',
      numeric: num,
    };
  }

  if (num <= 35) {
    return {
      label: 'Moderate Review',
      textClass: 'text-amber-700 dark:text-amber-400',
      barClass: 'bg-amber-600 dark:bg-amber-500',
      numeric: num,
    };
  }

  return {
    label: 'High Risk',
    textClass: 'text-red-700 dark:text-red-400',
    barClass: 'bg-red-600 dark:bg-red-500',
    numeric: num,
  };
}
