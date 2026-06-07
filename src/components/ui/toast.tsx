"use client";

/**
 * components/ui/toast.tsx
 *
 * Renders the active toasts as a fixed overlay in the bottom-right corner.
 * Mount <ToastContainer /> once inside the dashboard layout.
 *
 * Visual design:
 *   ✅ success — green
 *   ❌ error   — red
 *   ℹ️ info    — blue
 *   ⚠️ warning — amber
 */

import { useToast, type Toast, type ToastType } from "@/context/toast-context";

const STYLES: Record<ToastType, { bar: string; icon: string; text: string; close: string }> = {
  success: {
    bar: "bg-green-500",
    icon: "text-green-600",
    text: "text-green-900",
    close: "text-green-400 hover:text-green-600",
  },
  error: {
    bar: "bg-red-500",
    icon: "text-red-600",
    text: "text-red-900",
    close: "text-red-400 hover:text-red-600",
  },
  info: {
    bar: "bg-blue-500",
    icon: "text-blue-600",
    text: "text-blue-900",
    close: "text-blue-400 hover:text-blue-600",
  },
  warning: {
    bar: "bg-amber-500",
    icon: "text-amber-600",
    text: "text-amber-900",
    close: "text-amber-400 hover:text-amber-600",
  },
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const s = STYLES[toast.type];
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-lg bg-white shadow-lg ring-1 ring-black/5 overflow-hidden min-w-[280px] max-w-sm"
    >
      {/* Left colour bar */}
      <div className={`w-1 self-stretch flex-shrink-0 ${s.bar}`} />

      {/* Icon */}
      <span className={`mt-3 ${s.icon}`}>{ICONS[toast.type]}</span>

      {/* Message */}
      <p className={`flex-1 py-3 pr-1 text-sm font-medium ${s.text}`}>
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={`mt-2.5 mr-2 p-1 rounded transition-colors ${s.close}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
