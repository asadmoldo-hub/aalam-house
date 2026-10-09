"use client";

import { useState } from "react";
import { company, nav } from "@/lib/content";

export function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="header" id="top">
      <a href="#top" className="brand" onClick={close}>
        Аалам <em>Хаус</em>
      </a>
      <button
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        {open ? "Закрыть" : "Меню"}
      </button>
      <nav id="site-nav" className={open ? "nav open" : "nav"}>
        {nav.map((item) => (
          <a key={item.href} href={item.href} onClick={close}>
            {item.label}
          </a>
        ))}
        <a href={company.phoneHref} className="nav-phone">
          {company.phone}
        </a>
      </nav>
    </header>
  );
}
