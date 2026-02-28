import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Medium – Where good ideas find you",
  description: "Medium is a place to read, write, and connect with ideas that matter.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased bg-bg text-text-1`} suppressHydrationWarning>
        <Header />
        <main className="max-w-[1024px] mx-auto px-4 sm:px-6 lg:px-11 py-8">{children}</main>
      </body>
    </html>
  );
}