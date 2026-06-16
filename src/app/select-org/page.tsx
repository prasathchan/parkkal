"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-pk-danger-fill text-pk-danger-text",
  DOCTOR: "bg-pk-neutral-100 text-pk-neutral-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-pk-teal-100 text-pk-teal-700",
  ATTENDANT: "bg-pk-warning-fill text-pk-warning-text",
  HELPER: "bg-pk-surface-sunken text-pk-text-secondary",
};

function SelectOrgInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
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
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) {
        setError(data.error || "Failed to select organization");
        return;
      }
      sessionStorage.removeItem("pkd_orgs");
      router.push(from || "/dashboard");
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
      <div className="min-h-screen flex items-center justify-center bg-pk-bg">
        <div className="text-pk-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pk-bg p-4">
      <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 p-8 w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-pk-teal-600 rounded-full flex items-center justify-center mb-4">
            <Image src="/parkkal-mark-white.svg" alt="Parkkal" width={32} height={32} className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-pk-text">Select your workspace</h1>
          <p className="text-pk-text-muted text-sm mt-1">Choose an organization to continue</p>
        </div>

        {error && (
          <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => selectOrg(org.id)}
              disabled={selecting === org.id}
              className="w-full text-left p-4 border border-pk-border rounded-pk-lg hover:border-pk-teal-400 hover:shadow-pk-e2 transition-all group disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-pk-text text-base truncate">{org.name}</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ROLE_COLORS[org.role] || "bg-pk-surface-sunken text-pk-text-secondary"
                      }`}
                    >
                      {org.role}
                    </span>
                  </div>
                  {org.address && (
                    <p className="text-sm text-pk-text-muted truncate">{org.address}</p>
                  )}
                </div>
                <svg
                  className="w-5 h-5 text-pk-text-muted group-hover:text-pk-teal-500 flex-shrink-0 ml-3 transition-colors"
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
                <p className="text-xs text-pk-teal-600 mt-1">Signing in...</p>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-pk-teal-600 hover:text-pk-teal-800 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SelectOrgPage() {
  return (
    <Suspense>
      <SelectOrgInner />
    </Suspense>
  );
}
