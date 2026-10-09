import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import { company } from "@/lib/content";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${company.name} — аренда жилья на Иссык-Куле и по Кыргызстану`,
  description:
    "Посуточная и долгосрочная аренда квартир, домов и коттеджей на Иссык-Куле, в Бишкеке, Оше и других городах Кыргызстана.",
  openGraph: {
    title: company.name,
    description: company.tagline,
    images: ["/hero-cottage.jpg"],
    locale: "ru_RU",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf4e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={serif.variable}>
      <body>{children}</body>
    </html>
  );
}
