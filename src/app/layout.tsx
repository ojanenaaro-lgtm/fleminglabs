import type { Metadata } from "next";
import { Instrument_Sans, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FlemingLabs — AI Lab Notebook",
  description:
    "Voice-first AI lab notebook for researchers. Capture, connect, and discover.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${sourceSans3.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
