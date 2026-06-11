"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "set-password" | "verify-email" | "verify-phone" | "done";

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // mode=verify → Mode 3 (no password, just OTP verification)
  const isVerifyOnly = searchParams.get("mode") === "verify";

  const [step, setStep] = useState<Step>(isVerifyOnly ? "verify-email" : "set-password");
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // set-password step
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // email OTP step
  const [emailOtp, setEmailOtp] = useState("");

  // phone step
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter-phone" | "enter-otp">("enter-phone");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // For Mode 3: validate token immediately on page load
  useEffect(() => {
    if (isVerifyOnly && token && !userId) {
      validateToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validateToken() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode: "verify" }),
      });
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) { setError(data.error || "Invalid or expired link"); return; }
      setUserId(data.userId ?? "");
      await sendEmailOtp(data.userId ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailOtp(uid: string) {
    const res = await fetch("/api/staff/send-email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid }),
    });
    const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
    if (res.ok) setMaskedEmail(data.maskedEmail || "");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) { setError(data.error || "Activation failed"); return; }
      setUserId(data.userId ?? "");
      await sendEmailOtp(data.userId ?? "");
      setStep("verify-email");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: emailOtp }),
      });
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) { setError(data.error || "Verification failed"); return; }
      setStep("verify-phone");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) { setError("Phone number is required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/request-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phone }),
      });
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) { setError(data.error || "Failed to send OTP"); return; }
      setPhoneStep("enter-otp");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: phoneOtp }),
      });
      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };
      if (!res.ok) { setError(data.error || "Verification failed"); return; }
      if (isVerifyOnly) {
        setStep("done");
      } else {
        router.push("/login?message=Account+activated!+Please+sign+in.");
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-9 h-9">
          <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Parkkal</h1>
      <p className="text-slate-500 text-sm mt-1">One Platform. Every Clinic. Zero Compromises</p>
    </div>
  );

  const StepDots = () => {
    const steps = isVerifyOnly
      ? ["verify-email", "verify-phone"]
      : ["set-password", "verify-email", "verify-phone"];
    const currentIndex = steps.indexOf(step);
    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className={`w-2 h-2 rounded-full transition-colors ${i <= currentIndex ? "bg-blue-600" : "bg-slate-200"}`} />
        ))}
      </div>
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
          <Logo />
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 text-center">
            Invalid or expired link
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        <Logo />
        <StepDots />

        {/* Step 1: Set password (Mode 1 only) */}
        {step === "set-password" && (
          <>
            <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Set your password</h2>
            <p className="text-slate-500 text-sm text-center mb-6">Create a secure password to activate your account.</p>
            <form onSubmit={handleSetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                {loading ? "Setting password..." : "Set password & continue"}
              </button>
            </form>
          </>
        )}

        {/* Step 2: Verify email OTP */}
        {step === "verify-email" && (
          <>
            <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Verify your email</h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              {loading && !userId
                ? "Validating your link..."
                : `We sent a 6-digit code to ${maskedEmail || "your email"}. It expires in 15 minutes.`}
            </p>
            {userId && (
              <form onSubmit={handleVerifyEmail} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email verification code</label>
                  <input type="text" inputMode="numeric" value={emailOtp} onChange={e => setEmailOtp(e.target.value)} required maxLength={6} placeholder="000000"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg font-mono" />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                  {loading ? "Verifying..." : "Verify email"}
                </button>
                <button type="button" onClick={() => { setError(""); sendEmailOtp(userId); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition">
                  Resend code
                </button>
              </form>
            )}
            {!userId && error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 text-center">{error}</div>}
          </>
        )}

        {/* Step 3: Verify phone */}
        {step === "verify-phone" && (
          <>
            {phoneStep === "enter-phone" ? (
              <>
                <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Verify your phone</h2>
                <p className="text-slate-500 text-sm text-center mb-6">Enter your phone number to receive a one-time verification code.</p>
                <form onSubmit={handleSendPhoneOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+91 9876543210"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Enter verification code</h2>
                <p className="text-slate-500 text-sm text-center mb-6">
                  We sent a 6-digit code to <span className="font-medium text-slate-700">{phone}</span>. It expires in 15 minutes.
                </p>
                <form onSubmit={handleVerifyPhone} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone verification code</label>
                    <input type="text" inputMode="numeric" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)} required maxLength={6} placeholder="000000"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg font-mono" />
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                    {loading ? "Verifying..." : isVerifyOnly ? "Verify & complete" : "Verify & activate account"}
                  </button>
                  <button type="button" onClick={() => { setPhoneStep("enter-phone"); setPhoneOtp(""); setError(""); }}
                    className="w-full text-sm text-slate-500 hover:text-slate-700 transition">
                    Use a different phone number
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* Done (Mode 3 only) */}
        {step === "done" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Devices verified!</h2>
            <p className="text-slate-500 text-sm">Your email and phone have been verified. Your administrator will enable login access when ready.</p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          © {new Date().getFullYear()} Parkkal Clinic
        </p>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateForm />
    </Suspense>
  );
}
