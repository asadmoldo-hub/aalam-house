"use client";

import { useState } from "react";
import { leadOptions } from "@/lib/content";

type Status = "idle" | "sending" | "sent" | "error";

export function LeadForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="form" role="status">
        <div className="form-title">Спасибо! Мы свяжемся с вами в ближайший час.</div>
        <button className="btn btn-secondary" onClick={() => setStatus("idle")}>
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-title">Заявка на аренду</div>
      <label>
        Ваше имя
        <input name="name" required maxLength={80} placeholder="Айгуль" autoComplete="name" />
      </label>
      <label>
        Телефон
        <input
          name="phone"
          required
          type="tel"
          placeholder="+996"
          pattern="[+0-9 ()\-]{7,20}"
          autoComplete="tel"
        />
      </label>
      <label>
        Что ищете
        <select name="topic">
          {leadOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label>
        Пожелания
        <textarea name="message" rows={3} maxLength={1000} placeholder="Даты, число гостей, бюджет" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : "Отправить заявку"}
      </button>
      {status === "error" && (
        <p className="form-error" role="alert">
          Не получилось отправить. Позвоните нам или напишите в WhatsApp.
        </p>
      )}
      <p className="form-note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
    </form>
  );
}
