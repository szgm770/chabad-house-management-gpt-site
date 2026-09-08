import type { Metadata } from "next";
import "./globals.css";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מערכת ניהול בית חב״ד",
  description: "מערכת עבודה לניהול תורמים, תרומות וסקירות פעילות",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireChatGPTUser("/");
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
