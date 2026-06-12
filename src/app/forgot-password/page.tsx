"use client";

import { useState, Suspense } from "react";
import Link from "next/link";

type Mode = "request" | "reset" | "done";

function ForgotPasswordForm() {
  const [mode,     setMode]     = useState<Mode>("request");
  const [email,    setEmail]    = useState("");
  const [code,     setCode]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always move to reset step — uniform response prevents email enumeration
      setMode("reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Reset failed. Please try again."); return; }
      setMode("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-9 h-9">
              <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Parkkal</h1>
          <p className="text-slate-500 text-sm mt-1">One Platform. Every Clinic. Zero Compromises</p>
        </div>

        {mode === "request" && (
          <>
            <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Reset your password</h2>
            <p className="text-sm text-slate-500 text-center mb-6">Enter your email and we&apos;ll send you a 6-digit code.</p>
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                <input
                  id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="admin@clinic.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                {loading ? "Sending…" : "Send reset code"}
              </button>
            </form>
          </>
        )}

        {mode === "reset" && (
          <>
            <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Enter reset code</h2>
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 mb-5 text-center">
              If <strong>{email}</strong> has an account, a 6-digit code was sent. Check your inbox.
            </div>
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1.5">6-digit code</label>
                <input
                  id="code" type="text" inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required placeholder="123456"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <input
                  id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password" placeholder="Min 8 chars, letter + number"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  required autoComplete="new-password" placeholder="Repeat new password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm">
                {loading ? "Resetting…" : "Reset password"}
              </button>
              <button type="button" onClick={() => setMode("request")}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition">
                ← Change email address
              </button>
            </form>
          </>
        )}

        {mode === "done" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Password reset!</h2>
            <p className="text-sm text-slate-500 mb-6">Your password has been updated. You can now sign in with your new password.</p>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              Sign in
            </Link>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
