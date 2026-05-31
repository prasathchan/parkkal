"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { type OrgThemeConfig, DEFAULT_THEME, FONT_OPTIONS, getSidebarColors } from "@/lib/theme";

const ThemeContext = createContext<OrgThemeConfig>(DEFAULT_THEME);

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  config: OrgThemeConfig;
  children: ReactNode;
}

export function ThemeProvider({ config, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const font = FONT_OPTIONS.find(f => f.value === config.fontFamily) ?? FONT_OPTIONS[0];
    const sidebar = getSidebarColors(config);

    // Primary color
    root.style.setProperty("--primary", config.primaryColor);
    root.style.setProperty("--ring", config.primaryColor);
    root.style.setProperty("--font-body", font.stack);

    // Sidebar CSS vars
    root.style.setProperty("--sidebar-bg", sidebar.bg);
    root.style.setProperty("--sidebar-border", sidebar.border);
    root.style.setProperty("--sidebar-text", sidebar.text);
    root.style.setProperty("--sidebar-text-active", sidebar.textActive);
    root.style.setProperty("--sidebar-active-bg", sidebar.activeBg);
    root.style.setProperty("--sidebar-hover-bg", sidebar.hoverBg);
    root.style.setProperty("--sidebar-divider", sidebar.divider);

    // Dark mode
    const applyDark = (dark: boolean) => {
      root.classList.toggle("dark", dark);
    };

    if (config.darkMode === "dark") {
      applyDark(true);
    } else if (config.darkMode === "light") {
      applyDark(false);
    } else {
      // system
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [config]);

  return (
    <ThemeContext.Provider value={config}>
      {children}
    </ThemeContext.Provider>
  );
}
