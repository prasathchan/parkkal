import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { verifyOrgToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { parseThemeConfig } from "@/lib/theme";
import { getOrgSubscription } from "@/lib/subscription";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { DashboardProviders } from "@/components/providers/dashboard-providers";
import env from "@/lib/env";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pkd_org_session")?.value;

  if (!token) redirect("/login");

  const session = await verifyOrgToken(token);
  if (!session) redirect("/login");

  const db = getDb();
  const [org] = await db.select({
    logoUrl: organizations.logoUrl,
    themeConfig: organizations.themeConfig,
    tagline: organizations.tagline,
    dpaAcceptedAt: organizations.dpaAcceptedAt,
  }).from(organizations).where(eq(organizations.id, session.orgId));

  const subscription = await getOrgSubscription(db, session.orgId);

  // DPA gate: admins must accept the data processing agreement before using the dashboard.
  // Non-admins are not blocked — the org admin is responsible for org-level acceptance.
  if (session.role === "ADMIN" && !org?.dpaAcceptedAt) {
    redirect("/accept-dpa");
  }

  const themeConfig = parseThemeConfig(org?.themeConfig);
  const isReadOnly  = subscription?.isReadOnly ?? false;
  const trialDaysLeft = subscription?.status === "trialing" ? (subscription.daysRemaining ?? 0) : null;
  const isDemo = env.IS_DEMO === "true";

  return (
    <ThemeProvider config={themeConfig}>
      <div className="flex min-h-screen" style={{ background: "var(--pk-bg)" }}>
        <Sidebar
          user={{ name: session.name, role: session.role, orgName: session.orgName, orgTagline: org?.tagline ?? null }}
          logoUrl={org?.logoUrl ?? null}
        />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {/* Demo mode banner */}
          {isDemo && (
            <div className="bg-pk-teal-800 text-white px-5 py-2 flex items-center justify-between text-sm print:hidden">
              <span>
                <strong>Demo environment</strong> — data resets every 24 hours. No real patients or records here.
              </span>
              <a href="https://parkkal.app" target="_blank" rel="noreferrer" className="underline font-medium ml-4 whitespace-nowrap">
                Get started free →
              </a>
            </div>
          )}
          {/* Subscription banners */}
          {isReadOnly && (
            <div className="bg-pk-danger text-white px-5 py-2.5 flex items-center justify-between text-sm print:hidden">
              <span>
                {subscription?.status === "trialing"
                  ? "Your 30-day free trial has ended."
                  : "Your subscription has expired."}{" "}
                All records are read-only until you upgrade.
              </span>
              <a href="/dashboard/settings/billing" className="underline font-medium ml-4 whitespace-nowrap">
                Upgrade now →
              </a>
            </div>
          )}
          {!isReadOnly && trialDaysLeft !== null && trialDaysLeft >= 0 && (
            <div
              className="px-5 py-2 flex items-center justify-between text-sm print:hidden"
              style={
                trialDaysLeft <= 3
                  ? { background: "var(--pk-danger)", color: "white" }
                  : trialDaysLeft <= 7
                  ? { background: "var(--pk-warning)", color: "white" }
                  : { background: "var(--pk-teal-700)", color: "white" }
              }
            >
              <span>
                {trialDaysLeft === 0
                  ? "Your free trial ends today — upgrade to keep access."
                  : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}
              </span>
              <a href="/dashboard/settings/billing" className="underline font-medium ml-4 whitespace-nowrap">
                Upgrade →
              </a>
            </div>
          )}
          <DashboardProviders>{children}</DashboardProviders>
        </div>
      </div>
    </ThemeProvider>
  );
}
