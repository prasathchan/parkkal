"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export default function VerifyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendingPhone, setResendingPhone] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    const id = sessionStorage.getItem("pkd_signup_userId");
    const email = sessionStorage.getItem("pkd_signup_email");
    const phone = sessionStorage.getItem("pkd_signup_phone");

    if (!id) {
      router.replace("/signup");
      return;
    }

    setUserId(id);
    if (email) setMaskedEmail(maskEmail(email));
    if (phone) setMaskedPhone(maskPhone(phone));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, emailCode, phoneCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
        return;
      }

      // Clear signup session data
      sessionStorage.removeItem("pkd_signup_userId");
      sessionStorage.removeItem("pkd_signup_email");
      sessionStorage.removeItem("pkd_signup_phone");

      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(type: "EMAIL" | "PHONE") {
    setResendMsg("");
    setError("");
    const setter = type === "EMAIL" ? setResendingEmail : setResendingPhone;
    setter(true);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to resend OTP.");
      } else {
        setResendMsg(
          type === "EMAIL"
            ? "A new code has been sent to your email."
            : "A new code has been sent to your phone."
        );
      }
    } catch {
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setter(false);
    }
  }

  if (!userId) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              className="w-9 h-9"
            >
              <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Root Dental</h1>
          <p className="text-slate-500 text-sm mt-1">Deep Care, Strong Roots</p>
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">
          Verify your account
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          We sent verification codes to your email and phone. Enter both below to activate your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email OTP */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="emailCode"
                className="block text-sm font-medium text-slate-700"
              >
                Email verification code
              </label>
              <button
                type="button"
                onClick={() => handleResend("EMAIL")}
                disabled={resendingEmail}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {resendingEmail ? "Sending..." : "Resend"}
              </button>
            </div>
            {maskedEmail && (
              <p className="text-xs text-slate-400 mb-2">Sent to {maskedEmail}</p>
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
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Phone OTP */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="phoneCode"
                className="block text-sm font-medium text-slate-700"
              >
                Phone verification code
              </label>
              <button
                type="button"
                onClick={() => handleResend("PHONE")}
                disabled={resendingPhone}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {resendingPhone ? "Sending..." : "Resend"}
              </button>
            </div>
            {maskedPhone && (
              <p className="text-xs text-slate-400 mb-2">Sent to {maskedPhone}</p>
            )}
            <input
              id="phoneCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              placeholder="123456"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {resendMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              {resendMsg}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || emailCode.length < 6 || phoneCode.length < 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 text-sm"
          >
            {loading ? "Verifying..." : "Verify & activate account"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8">
          © 2026 Root Dental · app.rootdental.in
        </p>
      </div>
    </div>
  );
}
