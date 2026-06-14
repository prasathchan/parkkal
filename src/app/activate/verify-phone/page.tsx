"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (!userId) {
      setError("Invalid session. Please restart the activation process.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/staff/request-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone }),
      });

      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };

      if (!res.ok) {
        setError(data.error || "Failed to send OTP");
        return;
      }

      setStep("otp");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    if (!userId) {
      setError("Invalid session. Please restart the activation process.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/staff/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: otp }),
      });

      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      router.push("/login?message=Account+activated!+Please+sign+in.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pk-teal-50 to-pk-teal-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-pk-teal-600 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-9 h-9">
              <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-pk-text">Parkkal</h1>
          <p className="text-pk-text-muted text-sm mt-1">One Platform. Every Clinic. Zero Compromises</p>
        </div>

        {step === "phone" ? (
          <>
            <h2 className="text-xl font-semibold text-pk-text mb-2 text-center">Verify your phone</h2>
            <p className="text-pk-text-muted text-sm text-center mb-6">
              Enter your phone number. A one-time verification code will be sent to your email.
            </p>
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2.5 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 focus:border-transparent transition"
                />
              </div>

              {error && (
                <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 text-sm"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-pk-text mb-2 text-center">Enter verification code</h2>
            <p className="text-pk-text-muted text-sm text-center mb-6">
              We sent a 6-digit code to your email address. It expires in 15 minutes.
            </p>
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-4 py-2.5 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 focus:border-transparent transition text-center tracking-widest text-lg font-mono"
                />
              </div>

              {error && (
                <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 text-sm"
              >
                {loading ? "Verifying..." : "Verify & activate account"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="w-full text-sm text-pk-text-muted hover:text-pk-text-secondary transition"
              >
                Use a different phone number
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs text-pk-text-muted mt-8">
          © {new Date().getFullYear()} Parkkal Clinic · app.parkkal.com
        </p>
      </div>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense>
      <VerifyPhoneForm />
    </Suspense>
  );
}
