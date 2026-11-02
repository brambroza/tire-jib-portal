import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Sarabun } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"]
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  variable: "--font-thai",
  weight: ["300", "400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Dreammaker Thailand",
  description: "Admin portal for multi-site tire commerce",
  icons: {
    icon: [
      { url: "/assets/Logo.avif", type: "image/avif" },
      { url: "/favicon.ico" }
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/assets/Logo.avif", type: "image/avif" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${dmSans.variable} ${dmMono.variable} ${sarabun.variable}`}>
      <body>{children}</body>
    </html>
  );
}
