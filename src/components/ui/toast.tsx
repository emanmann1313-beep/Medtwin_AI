import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'warning' | 'info' | 'error';
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        removeToast(id);
      }, 4200);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const variant = t.variant ?? 'info';
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[#FFFFFF] p-4 shadow-lg dark:bg-[#172033]',
                variant === 'success' && 'border-[#0D9488]/40 dark:border-[#14B8A6]/40',
                variant === 'warning' && 'border-amber-300 dark:border-amber-500/40',
                variant === 'error' && 'border-red-300 dark:border-red-500/40',
                variant === 'info' && 'border-[#E2E8F0] dark:border-[#334155]',
              )}
            >
              {variant === 'success' && (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488] dark:text-[#14B8A6]" />
              )}
              {variant === 'warning' && (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              {variant === 'error' && (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              )}
              {variant === 'info' && (
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#3B82F6] dark:text-[#60A5FA]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#172554] dark:text-[#F8FAFC]">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#CCFBF1]/50 hover:text-[#172554] dark:text-[#94A3B8] dark:hover:bg-[#334155] dark:hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
