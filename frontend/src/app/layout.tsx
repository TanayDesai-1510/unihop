import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/app/Providers";
import { Splash, splashBootScript } from "@/components/brand/Splash";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UniHop",
  description: "Every ride under $10. Students only.",
  manifest: "/manifest.json",
  // /favicon.ico (16/32/48) comes from src/app/favicon.ico via Next's file convention.
  icons: {
    icon: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "UniHop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Browser chrome matches --bg (DESIGN.md section 2).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1222" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Marks repeat visits before first paint so the splash never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
      </head>
      <body>
        <Providers>
          {/* Phone-width app frame; on desktop it's a centered 430px column (DESIGN.md section 5). */}
          <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-bg min-[431px]:border-x min-[431px]:border-line">
            {children}
          </div>
          <Splash />
        </Providers>
      </body>
    </html>
  );
}
