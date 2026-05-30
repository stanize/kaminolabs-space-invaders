import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Space Invaders",
  description: "Can you defeat the alien invasion?",
  openGraph: {
    title: "Space Invaders",
    description: "Can you defeat the alien invasion?",
    url: "https://space-invaders.kaminolabs.dev",
    siteName: "Space Invaders",
    images: [{
      url: "https://space-invaders.kaminolabs.dev/og-image.png",
      width: 1200,
      height: 630,
      alt: "Space Invaders game preview"
    }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Space Invaders",
    description: "Can you defeat the alien invasion?",
    images: ["https://space-invaders.kaminolabs.dev/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
