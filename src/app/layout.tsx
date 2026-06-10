import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parkkal",
  description: "One Platform. Every Clinic. Zero Compromises",
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
