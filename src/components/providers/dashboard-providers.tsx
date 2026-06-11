"use client";

/**
 * Client-side providers for the dashboard layout.
 * The dashboard layout is a Server Component, so client context
 * providers must live in a separate "use client" file like this.
 */

import { ToastProvider } from "@/context/toast-context";
import { ToastContainer } from "@/components/ui/toast";
import { SidebarProvider } from "@/context/sidebar-context";
import { ErrorBoundary } from "@/components/error-boundary";
import type { ReactNode } from "react";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <ToastContainer />
      </ToastProvider>
    </SidebarProvider>
  );
}
