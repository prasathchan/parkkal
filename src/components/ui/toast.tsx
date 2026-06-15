"use client";

import { useToast, type Toast, type ToastType } from "@/context/toast-context";

const STYLES: Record<ToastType, { icon: string }> = {
  success: { icon: "text-pk-teal-300" },
  error:   { icon: "text-red-400" },
  info:    { icon: "text-pk-teal-400" },
  warning: { icon: "text-pk-gold-300" },
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
  const isAssertive = toast.type === "error";
  return (
    <div
      role="alert"
      aria-live={isAssertive ? "assertive" : "polite"}
      className="flex items-start gap-3 rounded-pk-md bg-pk-neutral-900 shadow-pk-e3 overflow-hidden min-w-[280px] max-w-sm"
    >
      <span className={`mt-3 ml-3 ${s.icon}`}>{ICONS[toast.type]}</span>

      <p className="flex-1 py-3 pr-1 text-sm font-medium text-pk-neutral-50">
        {toast.message}
      </p>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="mt-2.5 mr-2 p-1 rounded-pk-xs text-pk-neutral-400 hover:text-pk-neutral-50 transition-colors"
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
      className="fixed top-5 right-5 z-pk-toast flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
