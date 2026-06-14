"use client";

import React from "react";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack?.slice(0, 300));
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-pk-text mb-1">Something went wrong</h1>
        <p className="text-sm text-pk-text-muted mb-6 max-w-sm">
          {this.state.error?.message ?? "An unexpected error occurred. The team has been notified."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-pk-teal-600 text-white rounded-lg text-sm font-medium hover:bg-pk-teal-700 transition"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-pk-border text-pk-text-secondary rounded-lg text-sm font-medium hover:bg-pk-surface-raised transition"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }
}
