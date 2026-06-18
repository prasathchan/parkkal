"use client";

import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-pk-surface rounded-pk-lg shadow-pk-e3 w-full max-w-sm p-6 space-y-4">
        <h2 id="confirm-title" className="text-base font-semibold text-pk-text">{title}</h2>
        <p className="text-sm text-pk-text-secondary">{message}</p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-pk-sm border border-pk-border text-pk-text-secondary hover:bg-pk-surface-sunken transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-pk-sm text-white transition ${
              variant === "danger"
                ? "bg-pk-danger-solid hover:bg-red-700"
                : "bg-pk-primary hover:bg-pk-primary-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
