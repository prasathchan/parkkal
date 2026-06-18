"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { getSidebarColors } from "@/lib/theme";
import { authApi } from "@/api";
import { useSidebar } from "@/context/sidebar-context";

type SidebarColors = ReturnType<typeof getSidebarColors>;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  notAdmin?: boolean;
  sub?: boolean; // indented sub-item under a section
  altHrefs?: string[]; // additional paths that keep this item highlighted as active
  exact?: boolean; // when true, only active on exact pathname match (not startsWith)
}

interface NavSection {
  key: string;
  heading?: string;
  /** Collapsed by default for DOCTOR role */
  collapsibleForDoctor?: boolean;
  /** Entire section only visible to ADMIN */
  adminOnly?: boolean;
  items: NavItem[];
}

const navSections: NavSection[] = [
  // ── Top-level (no heading) ───────────────────────────────────────────────
  {
    key: "home",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },

  // ── Clinical ─────────────────────────────────────────────────────────────
  {
    key: "clinical",
    heading: "Clinical",
    items: [
      {
        label: "Patients",
        href: "/dashboard/patients",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        label: "Appointments",
        href: "/dashboard/appointments/calendar",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        altHrefs: ["/dashboard/appointments/list"],
      },
      {
        label: "Visits",
        href: "/dashboard/visits",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        label: "Treatment Plans",
        href: "/dashboard/treatments",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        label: "Recalls",
        href: "/dashboard/recalls",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
    ],
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  {
    key: "finance",
    heading: "Finance",
    collapsibleForDoctor: true,
    items: [
      {
        label: "Visit Billing",
        href: "/dashboard/billing",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
          </svg>
        ),
      },
      {
        label: "Standalone Invoices",
        href: "/dashboard/invoices",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        label: "Salary",
        href: "/dashboard/salary",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    key: "admin",
    heading: "Admin",
    collapsibleForDoctor: true,
    items: [
      {
        label: "Staff",
        href: "/dashboard/staff",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        label: "Roles",
        href: "/dashboard/roles",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        label: "Drug Formulary",
        href: "/dashboard/settings/drugs",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        ),
      },
      {
        label: "Calendar Sync",
        href: "/dashboard/settings/calendar",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        label: "Backup & Restore",
        href: "/dashboard/settings/backup",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
      },
      {
        label: "Locations",
        href: "/dashboard/settings/locations",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        label: "Subscription",
        href: "/dashboard/settings/billing",
        adminOnly: true,
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        adminOnly: true,
        sub: true,
        exact: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

// Isolated link component — own hover state avoids DOM mutation on every mouse move.
function NavLink({
  item,
  isActive,
  colors,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  colors: SidebarColors;
  onNavigate?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-pk-sm text-sm font-medium transition-colors",
        item.sub ? "px-3 py-2" : "px-3 py-2.5"
      )}
      style={{
        background: isActive ? colors.activeBg : hovered ? colors.hoverBg : "transparent",
        color: isActive ? colors.textActive : colors.text,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function UserMenu({
  user,
  onLogout,
  colors,
  primaryColor,
}: {
  user: { name: string; role: string };
  onLogout: () => void;
  colors: SidebarColors;
  primaryColor: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Popover menu — opens upward */}
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-pk-sm overflow-hidden shadow-lg z-50"
          style={{ background: colors.bg, border: `1px solid ${colors.divider}` }}
        >
          {/* User header inside popover */}
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${colors.divider}` }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: primaryColor }}>
                <span className="text-white text-sm font-bold">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: colors.textActive }}>{user.name}</p>
                <p className="text-xs truncate" style={{ color: colors.text, opacity: 0.6 }}>{user.role}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); router.push("/dashboard/profile"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
              style={{ color: colors.textActive }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </button>
            <button
              onClick={() => { setOpen(false); router.push("/dashboard/settings/security"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
              style={{ color: colors.textActive }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Change Password
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${colors.divider}` }} className="py-1">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
              style={{ color: "#C0392B" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 rounded-pk-sm px-1 py-1.5 transition-colors"
        style={{ background: open ? colors.hoverBg : "transparent" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
        aria-expanded={open}
        aria-haspopup="true"
        title="Account menu"
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: primaryColor }}>
          <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-medium truncate" style={{ color: colors.userText }}>{user.name}</p>
          <p className="text-xs truncate" style={{ color: colors.userSubText }}>{user.role}</p>
        </div>
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ color: colors.userSubText, transform: open ? "rotate(180deg)" : "none" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}

interface SidebarProps {
  user: { name: string; role: string; orgName?: string; orgTagline?: string | null };
  logoUrl?: string | null;
}

export function Sidebar({ user, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const colors = getSidebarColors(theme);
  const isAdmin = user.role === "ADMIN";
  const isDoctor = user.role === "DOCTOR";
  const isLight = theme.sidebarStyle === "light";
  const { isOpen, close } = useSidebar();

  // Sections collapsed by default for DOCTOR role; tracks which keys are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of navSections) {
      if (s.collapsibleForDoctor && isDoctor) initial[s.key] = true;
    }
    return initial;
  });

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const visibleSections = navSections
    .filter((s) => !s.adminOnly || isAdmin)
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (item) => (!item.adminOnly || isAdmin) && (!item.notAdmin || !isAdmin)
      ),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        data-sidebar=""
        className={cn(
          "print:hidden w-56 flex-shrink-0 h-screen flex flex-col transition-all duration-200",
          // Desktop: always visible, sticky
          "md:sticky md:top-0",
          // Mobile: fixed overlay, hidden by default, slides in when open
          "fixed top-0 left-0 z-50 md:relative md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: colors.bg, borderRight: isLight ? `1px solid ${colors.border}` : "none" }}
      >
      {/* Logo / Org Name */}
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${colors.divider}` }}>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="w-8 h-8 rounded-pk-sm overflow-hidden flex-shrink-0 bg-white/10">
              <Image src={logoUrl} alt="Logo" width={32} height={32} className="w-full h-full object-contain" unoptimized />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-pk-sm flex items-center justify-center flex-shrink-0 bg-white/10">
              <Image src="/parkkal-mark-white.svg" alt="" width={20} height={20} className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: colors.textActive }}>
              {user.orgName || "Parkkal"}
            </p>
            {user.orgTagline && (
              <p className="text-xs" style={{ color: colors.text, opacity: 0.7 }}>{user.orgTagline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {visibleSections.map((section) => {
          const isCollapsible = Boolean(section.collapsibleForDoctor);
          const isCollapsed = isCollapsible && collapsedSections[section.key];
          // Auto-expand if an item in this section is active
          const hasActiveItem = section.items.some((item) =>
            item.href === "/dashboard" || item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) || (item.altHrefs?.some((h) => pathname.startsWith(h)) ?? false)
          );
          const showItems = !isCollapsed || hasActiveItem;

          return (
            <div key={section.key}>
              {section.heading && (
                isCollapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center justify-between px-3 pb-1 group"
                    aria-expanded={showItems}
                  >
                    <span
                      className="text-xs font-semibold uppercase tracking-wider transition-opacity group-hover:opacity-70"
                      style={{ color: colors.text, opacity: 0.45 }}
                    >
                      {section.heading}
                    </span>
                    <svg
                      className="w-3 h-3 flex-shrink-0 transition-transform"
                      style={{ color: colors.text, opacity: 0.45, transform: showItems ? "rotate(180deg)" : "none" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <p
                    className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: colors.text, opacity: 0.45 }}
                  >
                    {section.heading}
                  </p>
                )
              )}
              {showItems && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      item.href === "/dashboard" || item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href) || (item.altHrefs?.some((h) => pathname.startsWith(h)) ?? false);
                    return (
                      <NavLink key={item.href} item={item} isActive={isActive} colors={colors} onNavigate={close} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="px-3 py-3" style={{ borderTop: `1px solid ${colors.divider}` }}>
        <UserMenu user={user} onLogout={handleLogout} colors={colors} primaryColor={theme.primaryColor} />
      </div>
    </aside>
    </>
  );
}
