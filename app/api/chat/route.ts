import { z } from "zod";
import { runAgent, type AgentEvent } from "@/lib/agent";
import { aiConfig } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { allow, clientKey } from "@/lib/rate-limit";
import type { CompanySettings } from "@/lib/types";

export const maxDuration = 60;

const MAX_HISTORY = 12; // в модель уходят только последние сообщения — экономия токенов
const MAX_TEXT = 2000;

const body = z.object({
  sessionId: z.uuid(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(200),
});

const json = (data: unknown, status: number) => Response.json(data, { status });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const { sessionId } = parsed.data;

  const history = parsed.data.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_TEXT) }))
    .filter((m) => m.content);
  const last = history[history.length - 1];
  if (last?.role !== "user") return json({ error: "bad_request" }, 400);
  if (parsed.data.messages[parsed.data.messages.length - 1].content.length > MAX_TEXT) return json({ error: "message_too_long" }, 413);

  if (!aiConfig.configured) return json({ error: "ai_not_configured" }, 503);

  // Лимиты: на посетителя (10 мин / сутки) и общий суточный потолок расходов
  const key = clientKey(req);
  if (!(await allow(`chat:${key}`, 20, 600)) || !(await allow(`chat-day:${key}`, 120, 86_400))) {
    return json({ error: "rate_limited" }, 429);
  }
  if (!(await allow("chat-global-day", 3000, 86_400))) return json({ error: "busy" }, 503);

  const db = createAdminClient();
  const { data: settings } = await db.from("company_settings").select("*").eq("id", 1).single<CompanySettings>();
  if (!settings) return json({ error: "not_configured" }, 503);
  if (!settings.chat_enabled) return json({ error: "chat_disabled" }, 503);

  // Сессия: создаётся при первом сообщении, привязана к посетителю
  const { data: session } = await db
    .from("chat_sessions")
    .select("client_key, transcript, message_count, input_tokens, output_tokens, tool_calls")
    .eq("id", sessionId)
    .maybeSingle();
  if (session && session.client_key !== key) return json({ error: "forbidden" }, 403);
  if (!session) {
    const { error } = await db.from("chat_sessions").insert({ id: sessionId, client_key: key });
    if (error) return json({ error: "session_error" }, 500);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: "error"; message: string }) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let answer = "";
      let usage = { input: 0, output: 0, tools: 0 };
      try {
        for await (const ev of runAgent({ settings, history, sessionId, clientKey: key })) {
          if (ev.type === "text") answer += ev.delta;
          if (ev.type === "done") usage = ev.usage;
          send(ev);
        }
      } catch (e) {
        const status = (e as { status?: number }).status;
        console.error("[chat] openai error", status, e instanceof Error ? e.message : e);
        send({
          type: "error",
          message:
            status === 429
              ? "Помощник сейчас перегружен. Попробуйте через минуту или позвоните нам."
              : "Помощник временно недоступен. Позвоните нам или оставьте заявку через форму.",
        });
      } finally {
        const now = new Date().toISOString();
        const transcript = [
          ...((session?.transcript as unknown[]) ?? []),
          { role: "user", text: last.content, at: now },
          ...(answer ? [{ role: "assistant", text: answer, at: now }] : []),
        ].slice(-100);
        await db
          .from("chat_sessions")
          .update({
            transcript,
            message_count: (session?.message_count ?? 0) + (answer ? 2 : 1),
            input_tokens: (session?.input_tokens ?? 0) + usage.input,
            output_tokens: (session?.output_tokens ?? 0) + usage.output,
            tool_calls: (session?.tool_calls ?? 0) + usage.tools,
          })
          .eq("id", sessionId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
