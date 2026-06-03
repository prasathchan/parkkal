"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DOCTOR: "bg-purple-100 text-purple-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-blue-100 text-blue-700",
  ATTENDANT: "bg-orange-100 text-orange-700",
  HELPER: "bg-gray-100 text-gray-700",
};

export default function SelectOrgPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null); // null = loading, [] = not found
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("pkd_orgs");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrgs(parsed as OrgOption[]);
          return;
        }
      }
    } catch {
      // sessionStorage unavailable or JSON corrupt
    }
    // No orgs in storage — the pre-org session cookie is still valid (middleware guards this
    // page), but the org list is gone. Redirect to login so the user can re-authenticate.
    router.replace("/login");
  }, [router]);

  async function selectOrg(orgId: string) {
    setSelecting(orgId);
    setError("");
    try {
      const res = await fetch("/api/auth/select-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to select organization");
        return;
      }
      sessionStorage.removeItem("pkd_orgs");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSelecting(null);
    }
  }

  // Show spinner while checking sessionStorage to avoid a flash of "No organizations found"
  if (orgs === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8">
              <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Select your workspace</h1>
          <p className="text-slate-500 text-sm mt-1">Choose an organization to continue</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => selectOrg(org.id)}
              disabled={selecting === org.id}
              className="w-full text-left p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 text-base truncate">{org.name}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ROLE_COLORS[org.role] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {org.role}
                    </span>
                  </div>
                  {org.address && (
                    <p className="text-sm text-slate-500 truncate">{org.address}</p>
                  )}
                </div>
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-blue-500 flex-shrink-0 ml-3 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              {selecting === org.id && (
                <p className="text-xs text-blue-600 mt-1">Signing in...</p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
