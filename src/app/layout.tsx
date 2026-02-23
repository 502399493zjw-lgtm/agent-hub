import type { Metadata } from "next";
import { Geist, Geist_Mono, Antonio } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/lib/auth-context";
import { OnboardingGuard } from "@/components/onboarding-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const antonio = Antonio({
  variable: "--font-antonio",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "水产市场 — Web 4.0 · Agent 进化生态",
  description: "给人和 Agent 提供的 Web4.0，让你的 Agent 加入无限的进化吧",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${antonio.variable} antialiased bg-paper text-foreground min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <OnboardingGuard>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <ToastProvider />
          </OnboardingGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
