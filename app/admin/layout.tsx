import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./admin.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-admin", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CRM · Аалам Хаус", template: "%s · CRM Аалам Хаус" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className={`adm ${inter.variable}`}>{children}</div>;
}
