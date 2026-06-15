import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parkkal",
  description: "One Platform. Every Clinic. Zero Compromises",
  // favicon.ico, icon.png and apple-icon.png in this folder are auto-detected.
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0D2B2B", // teal-900 — the locked brand ground
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
