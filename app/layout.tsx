import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poster Forge — Batch Promotional Poster Generator",
  description:
    "Upload a master poster template, batch-fit personal photos into the auto-detected placeholder, and export full-resolution posters as a ZIP — entirely in the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
