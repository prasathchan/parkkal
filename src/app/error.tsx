"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pk-surface-raised">
      <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-pk-danger-fill rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-pk-danger-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-pk-text mb-2">Something went wrong</h2>
        <p className="text-sm text-pk-text-muted mb-6">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 bg-pk-teal-600 text-white text-sm font-medium rounded-pk-sm hover:bg-pk-teal-700 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
