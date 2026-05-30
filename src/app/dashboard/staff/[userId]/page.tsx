"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";

interface Member {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  role: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string | null;
  isActive: number;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DOCTOR: "bg-purple-100 text-purple-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-blue-100 text-blue-700",
  ATTENDANT: "bg-orange-100 text-orange-700",
  HELPER: "bg-gray-100 text-gray-700",
};

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [salaryRecords, setSalaryRecords] = useState<unknown[]>([]);

  useEffect(() => {
    fetchMember();
    fetchSalary();
  }, [userId]);

  async function fetchMember() {
    const res = await fetch("/api/org/members");
    const data = await res.json();
    const found = (data.members || []).find((m: Member) => m.userId === userId);
    setMember(found || null);
    setLoading(false);
  }

  async function fetchSalary() {
    const res = await fetch("/api/org/salary");
    const data = await res.json();
    setSalaryRecords((data.records || []).filter((r: { userId: string }) => r.userId === userId));
  }

  if (loading) return <div className="flex-1 p-6 text-slate-500">Loading...</div>;
  if (!member) return <div className="flex-1 p-6 text-slate-500">Staff member not found.</div>;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Staff Detail"
        breadcrumb={[{ label: "Dashboard" }, { label: "Staff", href: "/dashboard/staff" }, { label: member.name }]}
      />
      <main className="flex-1 p-6 max-w-3xl space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-700 text-2xl font-bold">{member.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-slate-900">{member.name}</h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[member.role] || "bg-gray-100 text-gray-700"}`}>
                  {member.role}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Email: </span>
                  <span className="text-slate-900">{member.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Phone: </span>
                  <span className="text-slate-900">{member.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">DOB: </span>
                  <span className="text-slate-900">{member.dateOfBirth || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Gender: </span>
                  <span className="text-slate-900">{member.gender || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Joined: </span>
                  <span className="text-slate-900">{member.joinedAt || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status: </span>
                  <span className={member.isActive ? "text-green-600 font-medium" : "text-slate-500"}>
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Salary Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Salary Type</p>
              <p className="font-semibold text-slate-900">{member.salaryType}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-1">Amount</p>
              <p className="font-semibold text-slate-900">
                ₹{member.salaryAmount.toLocaleString("en-IN")}
                {member.salaryType === "PER_APPOINTMENT" ? "/appt" : "/month"}
              </p>
            </div>
          </div>
        </div>

        {/* Salary History */}
        {salaryRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Salary History</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-left font-medium text-slate-600">Month</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Amount</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Paid</th>
                  <th className="pb-2 text-left font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(salaryRecords as Array<{ month: string; salaryAmount: number; paidAmount: number; status: string }>).map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-700">{r.month}</td>
                    <td className="py-2 text-slate-700">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-slate-700">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "PAID" ? "bg-green-100 text-green-700" : r.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700 transition"
        >
          &larr; Back to Staff
        </button>
      </main>
    </div>
  );
}
