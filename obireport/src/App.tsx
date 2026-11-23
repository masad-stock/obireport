import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/landing/LandingPage';
import { ToastContainer } from './components/ui/ToastContainer';
import { DashboardShell } from './components/workspace/DashboardShell';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/auth/AuthPages';
import type { ToastItem } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">ObiReport</p>
          <p className="text-xs">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return firebaseUser ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">ObiReport</p>
          <p className="text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  return firebaseUser ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage theme={theme} onToggleTheme={toggleTheme} /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage theme={theme} onToggleTheme={toggleTheme} /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage theme={theme} onToggleTheme={toggleTheme} /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage theme={theme} onToggleTheme={toggleTheme} /></PublicRoute>} />
        <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage theme={theme} onToggleTheme={toggleTheme} /></PublicRoute>} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardShell theme={theme} onToggleTheme={toggleTheme} onNotify={notify} />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<LandingPage theme={theme} onToggleTheme={toggleTheme} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}