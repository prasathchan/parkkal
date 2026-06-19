"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orgApi, ApiError } from "@/api";
import type { StaffMember } from "@/types";

export function StaffAccountAccessCard({
  userId,
  member,
  onMemberRefresh,
}: {
  userId: string;
  member: StaffMember;
  onMemberRefresh: () => void;
}) {
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkMode, setLinkMode] = useState<"invite_link" | "no_login_verify">(
    (member as StaffMember & { portalAccess?: number }).portalAccess === 1 ? "invite_link" : "no_login_verify"
  );
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [phoneOtpResult, setPhoneOtpResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSendLink(mode: "invite_link" | "no_login_verify") {
    setLinkMode(mode);
    setSendingLink(true); setLinkError(""); setLinkSent(false);
    try {
      await orgApi.members.sendActivation(userId, mode);
      setLinkSent(true);
    } catch (e) {
      setLinkError(e instanceof ApiError ? e.message : "Failed to send link");
    } finally {
      setSendingLink(false);
    }
  }

  async function handleSendPhoneOtp() {
    if (!member.phone) return;
    setSendingPhoneOtp(true); setPhoneOtpResult(null);
    try {
      const res = await fetch("/api/staff/send-phone-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json() as { sent?: boolean; error?: string; smsSent?: boolean; emailSent?: boolean };
      if (res.ok && data.sent) {
        const channels = [data.smsSent ? "SMS" : null, data.emailSent ? "email" : null].filter(Boolean).join(" + ");
        setPhoneOtpResult({ ok: true, msg: `OTP sent via ${channels} to ${member.phone}` });
      } else {
        setPhoneOtpResult({ ok: false, msg: data.error ?? "Failed to send OTP" });
      }
    } catch {
      setPhoneOtpResult({ ok: false, msg: "Network error — please try again" });
    } finally {
      setSendingPhoneOtp(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Account Access</CardTitle></CardHeader>
      <CardContent className="space-y-5">

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "HR Status",
              value: member.isActive ? "Active" : "Inactive",
              icon: member.isActive
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
              color: member.isActive ? "text-pk-success-text bg-pk-success-fill" : "text-pk-text-muted bg-pk-surface-sunken",
            },
            {
              label: "Portal Login",
              value: member.portalAccess ? "Enabled" : "Disabled",
              icon: member.portalAccess
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
              color: member.portalAccess ? "text-pk-teal-700 bg-pk-teal-100" : "text-pk-warning-text bg-pk-warning-fill",
            },
            {
              label: "Verification",
              value: member.isVerified ? "Verified" : "Pending",
              icon: member.isVerified
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
              color: member.isVerified ? "text-teal-700 bg-teal-100" : "text-pk-warning-text bg-pk-warning-fill",
            },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-pk-sm border border-pk-border text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.color}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
              </div>
              <p className="text-xs text-pk-text-muted leading-tight">{item.label}</p>
              <p className="text-xs font-semibold text-pk-text leading-tight">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pk-text">Send Activation Email</p>
              <p className="text-xs text-pk-text-muted mt-0.5">Staff sets their own password and verifies email + phone. Login is enabled after.</p>
            </div>
            <Button size="sm" onClick={() => handleSendLink("invite_link")} disabled={sendingLink && linkMode === "invite_link"}>
              {sendingLink && linkMode === "invite_link" ? "Sending…" : "Send"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-pk-text">Send Verification Only</p>
              <p className="text-xs text-pk-text-muted mt-0.5">Verifies email and phone without enabling login access.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleSendLink("no_login_verify")} disabled={sendingLink && linkMode === "no_login_verify"}>
              {sendingLink && linkMode === "no_login_verify" ? "Sending…" : "Send"}
            </Button>
          </div>
          {linkError && <p className="text-xs text-pk-danger-text">{linkError}</p>}
          {linkSent && <p className="text-xs text-pk-success-text">Email sent to {member.email}</p>}
        </div>

        {member.phone && (
          <div className="flex items-center justify-between border-t border-pk-border pt-4">
            <div>
              <p className="text-sm font-medium text-pk-text">Phone Verification OTP</p>
              <p className="text-xs text-pk-text-muted mt-0.5">Send a one-time code to <span className="font-mono">{member.phone}</span></p>
              {phoneOtpResult && (
                <p className={`text-xs mt-1 ${phoneOtpResult.ok ? "text-pk-success-text" : "text-pk-danger-text"}`}>{phoneOtpResult.msg}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleSendPhoneOtp} disabled={sendingPhoneOtp}>
              {sendingPhoneOtp ? "Sending…" : "Send OTP"}
            </Button>
          </div>
        )}

        <details className="border border-pk-danger-border rounded-pk-sm">
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-medium text-pk-danger-text select-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Danger Zone
          </summary>
          <div className="px-4 pb-4 pt-2 space-y-3 border-t border-pk-danger-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pk-text">{member.isActive ? "Deactivate Staff" : "Reactivate Staff"}</p>
                <p className="text-xs text-pk-text-muted">{member.isActive ? "Removes HR access. Login is also disabled." : "Restores HR active status."}</p>
              </div>
              <Button size="sm" variant="outline"
                onClick={async () => {
                  await orgApi.members.update(userId, { isActive: !member.isActive });
                  onMemberRefresh();
                }}
                className="text-pk-danger-text border-pk-danger-border hover:bg-pk-danger-fill">
                {member.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          </div>
        </details>

      </CardContent>
    </Card>
  );
}
