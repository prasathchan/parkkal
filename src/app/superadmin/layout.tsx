import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { verifyOrgToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import Link from "next/link";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pkd_org_session")?.value;
  if (!token) redirect("/login");

  const session = await verifyOrgToken(token);
  if (!session) redirect("/login");

  const db = getDb();
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user?.isSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-sm tracking-wide">Parkkal Superadmin</span>
          <nav className="flex gap-1">
            {[
              { href: "/superadmin", label: "Overview" },
              { href: "/superadmin/subscriptions", label: "Subscriptions" },
              { href: "/superadmin/plans", label: "Plans & Pricing" },
              { href: "/superadmin/coupons", label: "Coupons" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="px-3 py-1.5 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition">
          ← Back to Dashboard
        </Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
