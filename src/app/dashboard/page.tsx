import Link from "next/link";
import { Header } from "@/components/header";
import { cookies } from "next/headers";
import { verifyOrgToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { organizations, organizationMembers, organizationPatients, appointments } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { OnboardingChecklist, type OnboardingStep } from "@/components/onboarding-checklist";
import { DashboardClientSection } from "@/components/dashboard/DashboardClientSection";
import type { SystemRole } from "@/types";

function ComplianceCard({
  dpaAcceptedAt,
  baaAcceptedAt,
  orgCreatedAt,
}: {
  dpaAcceptedAt: number | null;
  baaAcceptedAt: number | null;
  orgCreatedAt: number | null;
}) {
  const fmt = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const items = [
    {
      label: "Terms of Service",
      accepted: true,
      note: orgCreatedAt ? `Accepted ${fmt(orgCreatedAt)}` : "Accepted at signup",
      href: "/legal/terms",
    },
    {
      label: "Data Processing Agreement",
      sublabel: "DPDP Act 2023",
      accepted: !!dpaAcceptedAt,
      note: dpaAcceptedAt ? `Accepted ${fmt(dpaAcceptedAt)}` : null,
      href: "/legal/dpa/v1",
      actionHref: "/accept-dpa",
      actionLabel: "Accept DPA →",
    },
    {
      label: "HIPAA BAA",
      sublabel: "For international clinics",
      accepted: !!baaAcceptedAt,
      note: baaAcceptedAt ? `Accepted ${fmt(baaAcceptedAt)}` : null,
      href: "/legal/baa/v1",
      actionHref: "/dashboard/settings?tab=security",
      actionLabel: "Go International →",
      optional: true,
    },
  ];

  const allRequired = items.filter((i) => !i.optional).every((i) => i.accepted);

  return (
    <section aria-label="Compliance status">
      <div className="rounded-pk-md border border-pk-border bg-pk-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-sm font-semibold text-pk-text">Compliance</h2>
            {allRequired && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pk-success-fill text-pk-success-text border border-pk-success-border">
                All clear
              </span>
            )}
          </div>
          <Link href="/dashboard/settings?tab=security" className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition">
            Manage →
          </Link>
        </div>

        <div className="divide-y divide-pk-border">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {item.accepted ? (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pk-success-fill flex items-center justify-center">
                    <svg className="w-3 h-3 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : item.optional ? (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pk-surface-raised flex items-center justify-center">
                    <svg className="w-3 h-3 text-pk-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pk-warning-fill flex items-center justify-center">
                    <svg className="w-3 h-3 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-pk-text">{item.label}</span>
                    {item.sublabel && <span className="text-xs text-pk-text-muted">· {item.sublabel}</span>}
                  </div>
                  {item.note && (
                    <p className="text-xs text-pk-text-muted mt-0.5">{item.note}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={item.href} target="_blank" className="text-xs text-pk-text-muted hover:text-pk-text-secondary transition">
                  View
                </Link>
                {!item.accepted && item.actionHref && (
                  <Link href={item.actionHref} className="text-xs font-medium text-pk-teal-600 hover:underline">
                    {item.actionLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function getOnboardingState(orgId: string) {
  const db = getDb();
  const [orgRows, memberCountRows, patientCountRows, apptCountRows] = await Promise.all([
    db.select({
      phone: organizations.phone,
      address: organizations.address,
      logoUrl: organizations.logoUrl,
      onboardingDismissedAt: organizations.onboardingDismissedAt,
      dpaAcceptedAt: organizations.dpaAcceptedAt,
      baaAcceptedAt: organizations.baaAcceptedAt,
      createdAt: organizations.createdAt,
    }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    db.select({ val: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, orgId)),
    db.select({ val: count() }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
    db.select({ val: count() }).from(appointments).where(eq(appointments.organizationId, orgId)),
  ]);
  const org = orgRows[0];
  return {
    dismissed:       !!org?.onboardingDismissedAt,
    profileDone:     !!(org?.phone && org?.address),
    teamDone:        (memberCountRows[0]?.val ?? 0) > 1,
    patientDone:     (patientCountRows[0]?.val ?? 0) > 0,
    appointmentDone: (apptCountRows[0]?.val ?? 0) > 0,
    logoDone:        !!org?.logoUrl,
    dpaAcceptedAt:   org?.dpaAcceptedAt ?? null,
    baaAcceptedAt:   org?.baaAcceptedAt ?? null,
    createdAt:       org?.createdAt ?? null,
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const orgToken    = cookieStore.get("pkd_org_session")?.value;
  const session     = orgToken ? await verifyOrgToken(orgToken) : null;
  const onboarding  = session ? await getOnboardingState(session.orgId) : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Dashboard"
        breadcrumb={[{ label: "Home" }, { label: "Dashboard" }]}
        user={session ? { name: session.name, role: session.role } : undefined}
      />

      <main id="main-content" className="flex-1 p-6 space-y-6">

        {/* Onboarding checklist */}
        {onboarding && session && (() => {
          const steps: OnboardingStep[] = [
            { id: "profile",     label: "Set up your clinic profile",  description: "Name, address, and phone — appears on invoices and notifications", href: "/dashboard/settings",          done: onboarding.profileDone,     adminOnly: true  },
            { id: "team",        label: "Invite your team",            description: "Add doctors, receptionists, or assistants",                        href: "/dashboard/staff",             done: onboarding.teamDone,        adminOnly: true  },
            { id: "patient",     label: "Add your first patient",      description: "Patient records, contact details, and medical history",             href: "/dashboard/patients/new",      done: onboarding.patientDone,     adminOnly: false },
            { id: "appointment", label: "Book an appointment",         description: "Schedule the first visit and send an automated reminder",           href: "/dashboard/appointments/new",  done: onboarding.appointmentDone, adminOnly: false },
            { id: "logo",        label: "Upload your clinic logo",     description: "Appears on invoices and consent forms",                             href: "/dashboard/settings?tab=appearance", done: onboarding.logoDone, adminOnly: true  },
          ];
          return (
            <OnboardingChecklist
              steps={steps}
              role={session.role as SystemRole}
              dismissed={onboarding.dismissed}
              canDismiss={session.role === "ADMIN"}
            />
          );
        })()}

        {/* ── Compliance card — admin only ────────────────────────────────── */}
        {session?.role === "ADMIN" && onboarding && (
          <ComplianceCard
            dpaAcceptedAt={onboarding.dpaAcceptedAt}
            baaAcceptedAt={onboarding.baaAcceptedAt}
            orgCreatedAt={onboarding.createdAt}
          />
        )}

        {/* ── Zones A + B — location-aware schedule + stat strip ─────────── */}
        <DashboardClientSection />

        {/* ── Zone C — Quick Actions ──────────────────────────────────────── */}
        <section aria-label="Quick actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/dashboard/visits/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-teal-50 hover:border-pk-teal-200 transition group"
            >
              <div className="w-9 h-9 bg-pk-teal-100 rounded-pk-sm flex items-center justify-center group-hover:bg-pk-teal-200 transition flex-shrink-0">
                <svg className="w-5 h-5 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">New Visit</p>
                <p className="text-xs text-pk-text-muted">Walk-in or appointment</p>
              </div>
            </Link>

            <Link href="/dashboard/patients/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-teal-50 hover:border-pk-teal-200 transition group"
            >
              <div className="w-9 h-9 bg-pk-teal-100 rounded-pk-sm flex items-center justify-center group-hover:bg-pk-teal-200 transition flex-shrink-0">
                <svg className="w-5 h-5 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">New Patient</p>
                <p className="text-xs text-pk-text-muted">Register patient</p>
              </div>
            </Link>

            <Link href="/dashboard/appointments/new"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-success-fill hover:border-pk-success-border transition group"
            >
              <div className="w-9 h-9 bg-pk-success-fill rounded-pk-sm flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">Book Appointment</p>
                <p className="text-xs text-pk-text-muted">Schedule visit</p>
              </div>
            </Link>

            <Link href="/dashboard/billing"
              className="flex items-center gap-3 p-4 rounded-pk-md border border-pk-border bg-pk-surface hover:bg-pk-warning-fill hover:border-pk-warning-border transition group"
            >
              <div className="w-9 h-9 bg-pk-warning-fill rounded-pk-sm flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pk-text">Billing Queue</p>
                <p className="text-xs text-pk-text-muted">Manage invoices</p>
              </div>
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
