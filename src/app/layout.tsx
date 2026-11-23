import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";

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
  title: "Job Application Tracker",
  description: "Track your job applications on a Kanban board.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 font-sans">
        <a
          href="#main"
          className="sr-only rounded-md bg-white px-4 py-2 font-medium text-slate-900 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:outline-2 focus:outline-blue-600"
        >
          Skip to main content
        </a>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
