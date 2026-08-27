import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://futureclips.vercel.app"),
  title: "Future Clips — turn one clip into thirty posts",
  description:
    "Future Clips builds campaign-ready carousels in about two minutes. Same campaigns, same pay rate, ten times the output. 2 free carousels, no card.",
  openGraph: {
    title: "Future Clips — turn one clip into thirty posts",
    description:
      "Campaign-ready carousels in about two minutes. Same campaigns, same pay rate, ten times the output.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F7F8F9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
