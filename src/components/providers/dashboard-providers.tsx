"use client";

/**
 * Client-side providers for the dashboard layout.
 * The dashboard layout is a Server Component, so client context
 * providers must live in a separate "use client" file like this.
 */

import { ToastProvider } from "@/context/toast-context";
import { ToastContainer } from "@/components/ui/toast";
import type { ReactNode } from "react";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  );
}
