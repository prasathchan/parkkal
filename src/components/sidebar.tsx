"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
}

interface NavSection {
  heading?: string; // section label shown above items; omit for top-level items
  adminOnly?: boolean;
  items: NavItem[];
}

const navSections: NavSection[] = [
  // ── Top-level (no heading) ───────────────────────────────────────────────
  {
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

  // ── Patients ─────────────────────────────────────────────────────────────
  {
    heading: "Patients",
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
        href: "/dashboard/appointments",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
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

  // ── Billing ──────────────────────────────────────────────────────────────
  {
    heading: "Billing",
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
        label: "Reports",
        href: "/dashboard/reports",
        sub: true,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },

  // ── Team (admin only) ─────────────────────────────────────────────────────
  {
    heading: "Team",
    adminOnly: true,
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

  // ── System ────────────────────────────────────────────────────────────────
  {
    heading: "System",
    items: [
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
        label: "Settings",
        href: "/dashboard/settings",
        adminOnly: true,
        sub: true,
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
        "flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
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

function LogoutButton({
  onLogout,
  colors,
}: {
  onLogout: () => void;
  colors: SidebarColors;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onLogout}
      title="Sign out"
      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
      style={{
        color: hovered ? "#ef4444" : colors.text,
        background: hovered ? colors.hoverBg : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
      </svg>
    </button>
  );
}

interface SidebarProps {
  user: { name: string; role: string; orgName?: string };
  logoUrl?: string | null;
}

export function Sidebar({ user, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const colors = getSidebarColors(theme);
  const isAdmin = user.role === "ADMIN";
  const isLight = theme.sidebarStyle === "light";
  const { isOpen, close } = useSidebar();

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
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
              <Image src={logoUrl} alt="Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.sidebarStyle === "colored" ? "rgba(255,255,255,0.2)" : theme.primaryColor }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
              </svg>
            </div>
          )}
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: colors.textActive }}>
              {user.orgName || "Parkkal"}
            </p>
            <p className="text-xs" style={{ color: colors.text, opacity: 0.7 }}>One Platform. Every Clinic.</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {visibleSections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p
                className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors.text, opacity: 0.45 }}
              >
                {section.heading}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <NavLink key={item.href} item={item} isActive={isActive} colors={colors} onNavigate={close} />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${colors.divider}` }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.primaryColor }}>
            <span className="text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: colors.userText }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: colors.userSubText }}>{user.role}</p>
          </div>
          <LogoutButton onLogout={handleLogout} colors={colors} />
        </div>
      </div>
    </aside>
    </>
  );
}
