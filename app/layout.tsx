import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font — no render-blocking request to fonts.googleapis.com.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://futureclips.vercel.app"),
  title: "Future Clips — stop editing, start shipping volume",
  description:
    "Campaign-ready image carousels in about two minutes. Pick a live campaign, drop your assets, ship 30 posts today. 2 free carousels, no card.",
  openGraph: {
    title: "Future Clips — stop editing, start shipping volume",
    description:
      "Campaign-ready image carousels in about two minutes. Pick a live campaign, drop your assets, ship 30 posts today.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
