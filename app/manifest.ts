import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hive",
    short_name: "Hive",
    description: "Everything · Connected",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#17191f",
    theme_color: "#17191f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
