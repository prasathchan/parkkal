"use client";

import Link from "next/link";
import { useSidebar } from "@/context/sidebar-context";

interface HeaderProps {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  user?: { name: string; role: string };
}

export function Header({ title, breadcrumb, user }: HeaderProps) {
  const { toggle } = useSidebar();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:border focus:border-pk-teal-500 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium focus:text-pk-teal-700 focus:shadow-lg"
      >
        Skip to main content
      </a>
    <header className="bg-white border-b border-pk-border px-4 sm:px-6 py-4 flex items-center gap-3 justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only visible on mobile */}
        <button
          type="button"
          onClick={toggle}
          className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-pk-text-muted hover:bg-pk-surface-sunken transition"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-pk-text truncate">{title}</h1>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 mt-0.5 flex-wrap">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-pk-text-muted text-xs" aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="text-xs text-pk-teal-600 hover:text-pk-teal-800 hover:underline transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-xs text-pk-text-muted" aria-current={i === breadcrumb.length - 1 ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 bg-pk-teal-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-pk-text">{user.name}</p>
            <p className="text-xs text-pk-text-muted">{user.role}</p>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
