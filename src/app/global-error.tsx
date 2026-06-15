"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F3", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E5E0D8", padding: "32px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1C1A15", marginBottom: "8px" }}>Application error</h2>
            <p style={{ fontSize: "14px", color: "#645D50", marginBottom: "24px" }}>
              A critical error occurred. Please refresh the page.
            </p>
            <button
              onClick={reset}
              style={{ padding: "8px 20px", background: "#0B6E6E", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
