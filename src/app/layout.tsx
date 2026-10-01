import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLM-Agent × UniversalSniffer — Интеграция",
  description:
    "Анализ интеграции UniversalSniffer v3.1 в LLM-Agent v2026-10-01: MCP-сервер, агент, конвейер OAC и живая демо-панель сниффера.",
  keywords: ["UniversalSniffer", "LLM-Agent", "MCP", "сниффер", "интеграция", "АЗС"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "LLM-Agent × UniversalSniffer — Интеграция",
    description: "Анализ интеграции и живая сниффер-панель (демо-трафик)",
    siteName: "LLM-Agent × UniversalSniffer",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" duration={3000} closeButton />
      </body>
    </html>
  );
}
