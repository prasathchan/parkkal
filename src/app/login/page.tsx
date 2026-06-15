"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const from = searchParams.get("from");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as { error?: string; userId?: string; maskedEmail?: string; redirect?: string; requireOrgSelection?: boolean; organizations?: unknown; slug?: string };

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (data.requireOrgSelection) {
        sessionStorage.setItem("pkd_orgs", JSON.stringify(data.organizations));
        const nextUrl = from ? `/select-org?from=${encodeURIComponent(from)}` : "/select-org";
        router.push(nextUrl);
      } else {
        router.push(from || data.redirect || "/dashboard");
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pk-teal-50 to-pk-teal-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-pk-teal-900 rounded-full flex items-center justify-center mb-4">
            <Image src="/parkkal-mark-white.svg" alt="Parkkal" width={36} height={36} className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-pk-text">Parkkal</h1>
          <p className="text-pk-text-muted text-sm mt-1">One Platform. Every Clinic. Zero Compromises</p>
        </div>

        <h2 className="text-xl font-semibold text-pk-text mb-6 text-center">
          Sign in to your account
        </h2>

        {message && (
          <div className="bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-lg px-4 py-3 mb-4">
            {decodeURIComponent(message)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-pk-text-secondary mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@parkkal.com"
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-pk-text-secondary mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-pk-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="text-right -mt-1">
            <a href="/forgot-password" className="text-xs text-pk-teal-600 hover:text-pk-teal-700 hover:underline transition">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 text-sm"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-pk-border text-center">
          <p className="text-sm text-pk-text-muted">
            New to Parkkal?{" "}
            <a
              href="https://app.parkkal.com/signup"
              className="text-pk-teal-600 font-medium hover:text-pk-teal-700 hover:underline transition"
            >
              Create a clinic account
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-pk-text-muted mt-6">
          © {new Date().getFullYear()} Parkkal · app.parkkal.com
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
