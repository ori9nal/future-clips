import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./app.css";
import "./dashboard.css";
import "./clean-seal.css";
import "./brandkit.css";

// The product surface uses Archivo for headlines and Manrope for body — the
// same pairing as the live site, read off its computed styles rather than
// guessed. Archivo is also the engine's body face, so the app and the slides
// it renders share a voice.
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-archivo", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
// the small labels and anything counted are set in mono (the owner's design, 2026-09-19)
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

// This is the app, not the marketing page (that is future-clips-site/, static).
// Nothing here is indexable: every route past /login is behind auth.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://future-clips-app.vercel.app"),
  title: { default: "Future Clips", template: "%s · Future Clips" },
  description: "Campaign-ready carousel sets from a few words. The Future Clips app.",
  applicationName: "Future Clips",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${manrope.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        {/* the theme before first paint: the saved choice, else the system's; the toggle writes the same key */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('fc.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
