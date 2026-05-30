import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyOrgToken } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("pkd_org_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifyOrgToken(token);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={{ name: session.name, role: session.role, orgName: session.orgName }} />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
