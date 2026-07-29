import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spire Pipeline Tracker",
    short_name: "Spire Tracker",
    description: "Internal broker workload and pipeline tracker for Spire Mortgage Team",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F4",
    theme_color: "#22434B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
