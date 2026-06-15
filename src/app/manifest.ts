import type { MetadataRoute } from "next";

/** PWA web manifest — Parkkal brand (teal-900 ground, ivory background). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parkkal",
    short_name: "Parkkal",
    description: "One Platform. Every Clinic. Zero Compromises",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F5F0", // enamel ivory
    theme_color: "#0D2B2B", // teal-900
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
