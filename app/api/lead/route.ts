import { NextResponse } from "next/server";

type Lead = { name?: unknown; phone?: unknown; topic?: unknown; message?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Lead;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const lead = {
    name: str(body.name, 80),
    phone: str(body.phone, 20),
    topic: str(body.topic, 100),
    message: str(body.message, 1000),
  };

  if (!lead.name || !/^[+0-9 ()\-]{7,20}$/.test(lead.phone)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 422 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Без настроенного бота заявка просто пишется в лог (видно в Vercel → Logs)
  if (!token || !chatId) {
    console.log("[lead]", lead);
    return NextResponse.json({ ok: true });
  }

  const text = [
    "Новая заявка с сайта",
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Тема: ${lead.topic}`,
    lead.message && `Пожелания: ${lead.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    console.error("[lead] telegram error", res.status, await res.text());
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
