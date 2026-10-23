import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const phoneRe = /^[+0-9 ()\-]{7,20}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const leadInput = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(120),
  phone: z.string().trim().regex(phoneRe, "Телефон в формате +996 555 123 456"),
  email: z.union([z.literal(""), z.email().max(160)]).optional(),
  topic: z.string().trim().max(160).optional(),
  message: z.string().trim().max(2000).optional(),
  property_id: z.uuid().optional(),
  check_in: z.string().regex(isoDate).optional(),
  check_out: z.string().regex(isoDate).optional(),
  guests: z.number().int().min(1).max(500).optional(),
});

export type LeadInput = z.infer<typeof leadInput>;

const orNull = (v?: string) => (v && v.length ? v : null);

// Единая точка создания заявки для формы лендинга и AI-агента
export async function createLead(input: LeadInput, source: "website_form" | "ai_chat", chatSessionId?: string) {
  const db = createAdminClient();

  // Защита от дублей: заявка с того же телефона за последние 10 минут
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: dup } = await db
    .from("leads")
    .select("id")
    .eq("phone", input.phone)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (dup) return { id: dup.id as string, duplicate: true };

  const validRange = input.check_in && input.check_out && input.check_out > input.check_in;
  const { data, error } = await db
    .from("leads")
    .insert({
      name: input.name,
      phone: input.phone,
      email: orNull(input.email),
      topic: orNull(input.topic),
      message: orNull(input.message),
      source,
      property_id: input.property_id ?? null,
      check_in: validRange ? input.check_in : null,
      check_out: validRange ? input.check_out : null,
      guests: input.guests ?? null,
      chat_session_id: chatSessionId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (chatSessionId) {
    await db.from("chat_sessions").update({ lead_id: data.id }).eq("id", chatSessionId);
  }
  await notifyTelegram(input, source);
  return { id: data.id as string, duplicate: false };
}

async function notifyTelegram(lead: LeadInput, source: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = [
    `Новая заявка (${source === "ai_chat" ? "AI-чат" : "форма сайта"})`,
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    lead.topic && `Тема: ${lead.topic}`,
    lead.message && `Сообщение: ${lead.message}`,
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.error("[lead] telegram", res.status);
  } catch (e) {
    console.error("[lead] telegram", e);
  }
}
