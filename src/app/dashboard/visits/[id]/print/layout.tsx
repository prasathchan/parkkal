import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyOrgToken } from "@/lib/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pkd_org_session")?.value;
  if (!token) redirect("/login");
  const session = await verifyOrgToken(token);
  if (!session) redirect("/login");

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
