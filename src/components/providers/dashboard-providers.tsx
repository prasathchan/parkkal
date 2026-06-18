"use client";

/**
 * Client-side providers for the dashboard layout.
 * The dashboard layout is a Server Component, so client context
 * providers must live in a separate "use client" file like this.
 */

import { useEffect } from "react";
import { ToastProvider } from "@/context/toast-context";
import { ToastContainer } from "@/components/ui/toast";
import { SidebarProvider } from "@/context/sidebar-context";
import { CommandPaletteProvider, useCommandPalette } from "@/context/command-palette-context";
import { LocationProvider } from "@/context/location-context";
import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import type { ReactNode } from "react";

/** Global keyboard shortcuts wired here so they work on every dashboard page. */
function GlobalShortcuts() {
  const { toggle } = useCommandPalette();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
        || (e.target as HTMLElement)?.isContentEditable;

      // Cmd/Ctrl+K — always fires even inside inputs
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      if (inInput) return;

      // Bare K — open command palette
      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
  return null;
}

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <LocationProvider>
          <CommandPaletteProvider>
            <GlobalShortcuts />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <CommandPalette />
            <ToastContainer />
          </CommandPaletteProvider>
        </LocationProvider>
      </ToastProvider>
    </SidebarProvider>
  );
}
