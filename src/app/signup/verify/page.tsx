"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}


export default function VerifyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    const id = sessionStorage.getItem("pkd_signup_userId");
    const email = sessionStorage.getItem("pkd_signup_email");

    if (!id) {
      router.replace("/signup");
      return;
    }

    setUserId(id);
    if (email) setMaskedEmail(maskEmail(email));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, emailCode }),
      });

      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        return;
      }

      // Clear signup session data
      sessionStorage.removeItem("pkd_signup_userId");
      sessionStorage.removeItem("pkd_signup_email");

      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    setResendingEmail(true);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type: "EMAIL" }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error || "Failed to resend OTP.");
      } else {
        setResendMsg("A new code has been sent to your email.");
      }
    } catch {
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setResendingEmail(false);
    }
  }

  if (!userId) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pk-bg py-12 px-4">
      <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 p-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-pk-teal-600 rounded-full flex items-center justify-center mb-4">
            <Image src="/parkkal-mark-white.svg" alt="Parkkal" width={36} height={36} className="w-9 h-9" unoptimized />
          </div>
          <h1 className="text-2xl font-bold text-pk-text">Parkkal</h1>
          <p className="text-pk-text-muted text-sm mt-1">One Platform. Every Clinic. Zero Compromises</p>
        </div>

        <h2 className="text-xl font-semibold text-pk-text mb-2 text-center">
          Verify your account
        </h2>
        <p className="text-sm text-pk-text-muted text-center mb-6">
          We sent a verification code to your email. Enter it below to activate your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email OTP */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="emailCode"
                className="block text-sm font-medium text-pk-text-secondary"
              >
                Email verification code
              </label>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendingEmail}
                className="text-xs text-pk-teal-600 hover:underline disabled:opacity-50"
              >
                {resendingEmail ? "Sending..." : "Resend"}
              </button>
            </div>
            {maskedEmail && (
              <p className="text-xs text-pk-text-muted mb-2">Sent to {maskedEmail}</p>
            )}
            <input
              id="emailCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              placeholder="123456"
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-pk-sm text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-pk-teal-500 focus:border-transparent transition"
            />
            <p className="text-xs text-pk-warning-text mt-1.5">
              Can&apos;t find it? Check your <strong>Junk</strong> or <strong>Spam</strong> folder.
            </p>
          </div>

          {resendMsg && (
            <div className="bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">
              {resendMsg}
            </div>
          )}

          {error && (
            <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || emailCode.length < 6}
            className="w-full bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white font-semibold py-2.5 px-4 rounded-pk-sm transition duration-200 text-sm"
          >
            {loading ? "Verifying..." : "Verify & activate account"}
          </button>
        </form>

        <p className="text-center text-xs text-pk-text-muted mt-8">
          © {new Date().getFullYear()} Parkkal Clinic · app.parkkal.com
        </p>
      </div>
    </div>
  );
}
