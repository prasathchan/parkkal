import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { verifyOrgToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { parseThemeConfig } from "@/lib/theme";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { DashboardProviders } from "@/components/providers/dashboard-providers";

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
  const [org] = await db.select({ logoUrl: organizations.logoUrl, themeConfig: organizations.themeConfig })
    .from(organizations)
    .where(eq(organizations.id, session.orgId));

  const themeConfig = parseThemeConfig(org?.themeConfig);

  return (
    <ThemeProvider config={themeConfig}>
      <div className="flex min-h-screen" style={{ background: "var(--background)" }}>
        <Sidebar
          user={{ name: session.name, role: session.role, orgName: session.orgName }}
          logoUrl={org?.logoUrl ?? null}
        />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <DashboardProviders>{children}</DashboardProviders>
        </div>
      </div>
    </ThemeProvider>
  );
}
