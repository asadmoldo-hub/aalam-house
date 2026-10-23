"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/admin/actions/auth";

const icons: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" />,
  leads: <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5z" />,
  clients: <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13Zm8 0h-.9a4.2 4.2 0 0 1 1.9 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5Z" />,
  properties: <path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z" />,
  bookings: <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V9h14zM7 11h5v5H7z" />,
  analytics: <path d="M5 9h3v11H5zm5.5-5h3v16h-3zM16 13h3v7h-3z" />,
  knowledge: <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z" />,
  settings: <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.3 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L9 21h4l.3-2.9a7 7 0 0 0 1.7-1l2.5 1 2-3.5ZM12 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5Z" />,
};

const items = [
  { href: "/admin", label: "Дашборд", icon: "dashboard" },
  { href: "/admin/leads", label: "Заявки", icon: "leads", badge: true },
  { href: "/admin/clients", label: "Клиенты", icon: "clients" },
  { href: "/admin/properties", label: "Объекты", icon: "properties" },
  { href: "/admin/bookings", label: "Бронирования", icon: "bookings" },
  { href: "/admin/analytics", label: "Аналитика", icon: "analytics" },
  { href: "/admin/knowledge", label: "База знаний", icon: "knowledge" },
  { href: "/admin/settings", label: "Настройки", icon: "settings" },
];

export function Sidebar({ name, role, newLeads }: { name: string; role: string; newLeads: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  return (
    <>
      <div className="a-topbar">
        <b>Аалам Хаус · CRM</b>
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="a-side">
          Меню
        </button>
      </div>
      <aside id="a-side" className={open ? "a-side open" : "a-side"}>
        <Link href="/admin" className="a-brand" onClick={() => setOpen(false)}>
          <span className="a-brand-mark">А</span>
          <span>
            Аалам Хаус
            <small>CRM аренды</small>
          </span>
        </Link>
        <nav className="a-nav">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={isActive(it.href) ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {icons[it.icon]}
              </svg>
              {it.label}
              {it.badge && newLeads > 0 && <span className="count">{newLeads}</span>}
            </Link>
          ))}
          <a href="/" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zm5 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z" />
            </svg>
            Открыть сайт
          </a>
        </nav>
        <div className="a-user">
          <b>{name}</b>
          <span>{role === "admin" ? "Администратор" : "Менеджер"}</span>
          <form action={signOut}>
            <button type="submit">Выйти</button>
          </form>
        </div>
      </aside>
    </>
  );
}
