import "server-only";
import type OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchKnowledge } from "@/lib/kb";
import { createLead, leadInput } from "@/lib/leads";
import { allow } from "@/lib/rate-limit";
import { aiConfig, openai } from "@/lib/openai";
import { nightsBetween, priceUnitLabel, propertyKindLabel, regionLabel, todayIso } from "@/lib/labels";
import type { CompanySettings, Property } from "@/lib/types";

const MAX_ROUNDS = 5; // максимум раундов «модель → инструменты → модель» за одно сообщение
const MAX_TOOL_CALLS = 8; // максимум вызовов инструментов за одно сообщение
const MAX_OUTPUT_TOKENS = 700;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД");
const nullable = <T extends z.ZodType>(t: T) => t.nullable().transform((v) => v ?? undefined);

// ───────────── Схемы для OpenAI (strict: все поля обязательны, необязательные — через null) ─────────────

const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const orNull = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type as string, "null"] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const regionEnum = ["issyk_kul_north", "issyk_kul_south", "bishkek", "osh", "other"];
const kindEnum = ["apartment", "house", "cottage", "guest_house", "camp", "office", "commercial"];

export const toolDefinitions: OpenAI.Responses.FunctionTool[] = [
  {
    type: "function",
    name: "get_business_info",
    description: "Контакты, адрес, график работы и описание компании.",
    strict: true,
    parameters: obj({}),
  },
  {
    type: "function",
    name: "get_services",
    description: "Актуальный список услуг компании (виды аренды и сервисы).",
    strict: true,
    parameters: obj({}),
  },
  {
    type: "function",
    name: "list_properties",
    description:
      "Поиск объектов аренды в каталоге с актуальными ценами в сомах. Используй для подбора жилья и любых вопросов о ценах на жильё. Неизвестные фильтры передавай null.",
    strict: true,
    parameters: obj({
      region: {
        type: ["string", "null"],
        enum: [...regionEnum, null],
        description: "issyk_kul_north — Чолпон-Ата, Бостери, Кара-Ой, Чок-Тал; issyk_kul_south — Тосор, Каракол, Жети-Огуз",
      },
      kind: { type: ["string", "null"], enum: [...kindEnum, null] },
      price_unit: { type: ["string", "null"], enum: ["night", "month", null], description: "night — посуточно, month — долгосрочно" },
      max_price: { type: ["number", "null"], description: "Максимальная цена в сомах за единицу price_unit" },
      guests: { type: ["integer", "null"], description: "Число гостей" },
    }),
  },
  {
    type: "function",
    name: "check_availability",
    description: "Проверяет, свободен ли объект на даты, и считает предварительную стоимость. property_id бери из list_properties.",
    strict: true,
    parameters: obj({
      property_id: str("id объекта из list_properties"),
      check_in: str("Дата заезда ГГГГ-ММ-ДД"),
      check_out: str("Дата выезда ГГГГ-ММ-ДД"),
    }),
  },
  {
    type: "function",
    name: "search_knowledge",
    description:
      "Поиск в базе знаний компании: условия, залог, оплата, отмена, животные, трансфер, как сдать жильё и любые другие вопросы о компании. Отвечай только по найденному.",
    strict: true,
    parameters: obj({ query: str("Вопрос посетителя своими словами, на русском") }),
  },
  {
    type: "function",
    name: "create_lead",
    description:
      "Создаёт заявку менеджеру в CRM. Вызывай ТОЛЬКО после того, как посетитель сообщил имя и телефон, ты пересказал данные и посетитель явно подтвердил отправку.",
    strict: true,
    parameters: obj({
      user_confirmed: { type: "boolean", description: "true, только если посетитель явно подтвердил отправку заявки" },
      name: str("Имя посетителя"),
      phone: str("Телефон, например +996 555 123 456"),
      email: orNull(str()),
      property_id: orNull(str("id объекта, если выбран")),
      check_in: orNull(str("ГГГГ-ММ-ДД")),
      check_out: orNull(str("ГГГГ-ММ-ДД")),
      guests: { type: ["integer", "null"] },
      summary: str("Кратко: что ищет посетитель, пожелания, бюджет"),
    }),
  },
];

// ───────────── Серверная проверка аргументов (не доверяем модели) ─────────────

const argSchemas = {
  get_business_info: z.object({}).strict(),
  get_services: z.object({}).strict(),
  list_properties: z.object({
    region: nullable(z.enum(regionEnum as [string, ...string[]])),
    kind: nullable(z.enum(kindEnum as [string, ...string[]])),
    price_unit: nullable(z.enum(["night", "month"])),
    max_price: nullable(z.number().positive().max(10_000_000)),
    guests: nullable(z.number().int().min(1).max(500)),
  }),
  check_availability: z.object({ property_id: z.uuid(), check_in: isoDate, check_out: isoDate }),
  search_knowledge: z.object({ query: z.string().trim().min(2).max(300) }),
  create_lead: z.object({
    user_confirmed: z.boolean(),
    name: z.string(),
    phone: z.string(),
    email: nullable(z.string()),
    property_id: nullable(z.string()),
    check_in: nullable(z.string()),
    check_out: nullable(z.string()),
    guests: nullable(z.number().int()),
    summary: z.string().max(1500),
  }),
} as const;

type ToolName = keyof typeof argSchemas;

const publicProperty = (p: Property) => ({
  id: p.id,
  title: p.title,
  type: propertyKindLabel[p.kind],
  region: regionLabel[p.region],
  location: p.location,
  capacity: p.capacity,
  max_guests: p.max_guests,
  price: Number(p.price),
  price_per: priceUnitLabel[p.price_unit],
  features: p.features,
  description: p.description,
});

async function execute(name: string, rawArgs: string, ctx: { sessionId: string; clientKey: string }): Promise<unknown> {
  if (!(name in argSchemas)) return { error: `Неизвестный инструмент ${name}` };
  let json: unknown;
  try {
    json = JSON.parse(rawArgs || "{}");
  } catch {
    return { error: "Некорректные аргументы" };
  }
  const parsed = argSchemas[name as ToolName].safeParse(json);
  if (!parsed.success) return { error: "Некорректные аргументы", details: parsed.error.issues.map((i) => i.message) };
  const db = createAdminClient();

  switch (name as ToolName) {
    case "get_business_info": {
      const { data, error } = await db
        .from("company_settings")
        .select("name, tagline, phone, whatsapp_url, telegram_url, email, address, hours, about")
        .eq("id", 1)
        .single();
      return error ? { error: "Не удалось получить данные компании" } : data;
    }
    case "get_services": {
      const { data, error } = await db.from("services").select("title, kicker, description").eq("is_active", true).order("sort_order");
      return error ? { error: "Не удалось получить услуги" } : { services: data };
    }
    case "list_properties": {
      const a = parsed.data as z.infer<(typeof argSchemas)["list_properties"]>;
      let q = db.from("properties").select("*").eq("status", "active").order("sort_order").limit(10);
      if (a.region) q = q.eq("region", a.region);
      if (a.kind) q = q.eq("kind", a.kind);
      if (a.price_unit) q = q.eq("price_unit", a.price_unit);
      if (a.max_price) q = q.lte("price", a.max_price);
      if (a.guests) q = q.or(`max_guests.gte.${a.guests},max_guests.is.null`);
      const { data, error } = await q.returns<Property[]>();
      if (error) return { error: "Не удалось получить объекты" };
      return { count: data.length, properties: data.map(publicProperty) };
    }
    case "check_availability": {
      const { property_id, check_in, check_out } = parsed.data as z.infer<(typeof argSchemas)["check_availability"]>;
      if (check_out <= check_in) return { error: "Дата выезда должна быть позже даты заезда" };
      if (check_in < todayIso()) return { error: "Дата заезда уже прошла" };
      const nights = nightsBetween(check_in, check_out);
      if (nights > 366) return { error: "Слишком длинный период" };
      const { data: property } = await db.from("properties").select("*").eq("id", property_id).eq("status", "active").maybeSingle<Property>();
      if (!property) return { error: "Объект не найден" };
      const { data: conflicts, error } = await db
        .from("bookings")
        .select("check_in, check_out")
        .eq("property_id", property_id)
        .neq("status", "cancelled")
        .lt("check_in", check_out)
        .gt("check_out", check_in);
      if (error) return { error: "Не удалось проверить занятость" };
      return {
        property: property.title,
        check_in,
        check_out,
        available: conflicts.length === 0,
        busy_periods: conflicts,
        nights,
        estimated_total: property.price_unit === "night" ? `${nights * Number(property.price)} сом` : null,
        note:
          property.price_unit === "month"
            ? "Долгосрочная аренда: цена за месяц, итог считает менеджер."
            : "Стоимость предварительная, менеджер подтвердит при бронировании.",
      };
    }
    case "search_knowledge": {
      const { query } = parsed.data as { query: string };
      try {
        const { hits, mode } = await searchKnowledge(query, 4);
        if (!hits.length) return { found: false, message: "В базе знаний нет подтверждённой информации по этому вопросу." };
        return { found: true, search_mode: mode, results: hits.map(({ title, content }) => ({ title, content: content.slice(0, 1200) })) };
      } catch {
        return { error: "Поиск по базе знаний временно недоступен" };
      }
    }
    case "create_lead": {
      const a = parsed.data as z.infer<(typeof argSchemas)["create_lead"]>;
      if (a.user_confirmed !== true) return { ok: false, error: "Нужно явное подтверждение посетителя" };
      const lead = leadInput.safeParse({
        name: a.name,
        phone: a.phone,
        email: a.email,
        property_id: a.property_id,
        check_in: a.check_in,
        check_out: a.check_out,
        guests: a.guests,
        topic: "Заявка из AI-чата",
        message: a.summary,
      });
      if (!lead.success) return { ok: false, error: lead.error.issues.map((i) => i.message).join("; ") };
      if (!(await allow(`chat-lead:${ctx.clientKey}`, 3, 3600))) {
        return { ok: false, error: "Превышен лимит заявок. Попросите посетителя позвонить по телефону компании." };
      }
      try {
        const res = await createLead(lead.data, "ai_chat", ctx.sessionId);
        return { ok: true, duplicate: res.duplicate, message: "Заявка передана менеджеру, он свяжется в течение часа." };
      } catch {
        return { ok: false, error: "Не удалось сохранить заявку" };
      }
    }
  }
}

export function systemPrompt(s: CompanySettings) {
  return `Ты — AI-помощник компании «${s.name}» (${s.tagline}). Общаешься с посетителями сайта дружелюбно и коротко.

Язык: отвечай на языке посетителя — русском или кыргызском (кыргыз тилинде жооп бер, эгер конок кыргызча жазса). Для поиска в базе знаний формулируй запрос на русском.

Сегодня: ${todayIso()}. Часовой пояс — Бишкек.

Задача: помочь подобрать жильё, ответить на вопросы и, если посетитель хочет, оформить заявку менеджеру.

Правила:
1. Факты о компании, ценах, объектах, условиях и свободных датах бери ТОЛЬКО из инструментов. Не придумывай цены, объекты, скидки и условия.
2. Жильё и цены — list_properties. Свободные даты — check_availability (сначала узнай id через list_properties). Услуги — get_services. Контакты и график — get_business_info. Условия, залог, оплата, отмена, животные и прочее — search_knowledge.
3. Если инструмент не нашёл ответа, прямо скажи, что подтверждённой информации нет, и предложи связаться с менеджером: ${s.phone}, ${s.hours}.
4. Когда уместно, предложи оставить заявку. Нужны имя и телефон. Перед create_lead перескажи данные и спроси явное согласие. Без явного «да» заявку не создавай.
5. Не проси паспортные данные и данные банковских карт, не принимай оплату.
6. Даты передавай в формате ГГГГ-ММ-ДД; если год не назван, бери ближайшую будущую дату.
7. Ответ — до 120 слов, без таблиц и markdown-разметки. Цены пиши в сомах.${
    s.chat_instructions ? `\n\nДополнительные указания администратора:\n${s.chat_instructions}` : ""
  }`;
}

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "lead_created" }
  | { type: "done"; usage: { input: number; output: number; tools: number } };

// Цикл function calling через Responses API: модель → вызовы функций → результаты → модель.
// Текст стримится посетителю по мере генерации.
export async function* runAgent(opts: {
  settings: CompanySettings;
  history: { role: "user" | "assistant"; content: string }[];
  sessionId: string;
  clientKey: string;
}): AsyncGenerator<AgentEvent> {
  const ai = openai();
  let input: OpenAI.Responses.ResponseInput = opts.history.map((m) => ({ role: m.role, content: m.content }));
  let previousId: string | undefined;
  let toolCalls = 0;
  const usage = { input: 0, output: 0, tools: 0 };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const allowTools = toolCalls < MAX_TOOL_CALLS && round < MAX_ROUNDS - 1;
    const stream = await ai.responses.create({
      model: aiConfig.chatModel,
      instructions: systemPrompt(opts.settings),
      input,
      previous_response_id: previousId,
      tools: toolDefinitions,
      tool_choice: allowTools ? "auto" : "none",
      parallel_tool_calls: true,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: true, // нужно для previous_response_id внутри цикла инструментов
      safety_identifier: opts.clientKey,
      prompt_cache_key: "aalam-chat-v1",
      stream: true,
    });

    const calls: OpenAI.Responses.ResponseFunctionToolCall[] = [];
    let responseId: string | undefined;

    for await (const ev of stream) {
      if (ev.type === "response.output_text.delta") {
        yield { type: "text", delta: ev.delta };
      } else if (ev.type === "response.output_item.done" && ev.item.type === "function_call") {
        calls.push(ev.item);
      } else if (ev.type === "response.completed") {
        responseId = ev.response.id;
        usage.input += ev.response.usage?.input_tokens ?? 0;
        usage.output += ev.response.usage?.output_tokens ?? 0;
      } else if (ev.type === "response.failed" || ev.type === "error") {
        throw new Error(ev.type === "error" ? ev.message : (ev.response.error?.message ?? "response.failed"));
      } else if (ev.type === "response.incomplete") {
        responseId = ev.response.id;
        usage.input += ev.response.usage?.input_tokens ?? 0;
        usage.output += ev.response.usage?.output_tokens ?? 0;
      }
    }

    if (!calls.length) break;

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    const allowed = calls.slice(0, Math.max(0, MAX_TOOL_CALLS - toolCalls));
    for (const call of allowed) {
      toolCalls++;
      yield { type: "tool", name: call.name };
      const result = await execute(call.name, call.arguments, { sessionId: opts.sessionId, clientKey: opts.clientKey });
      if (call.name === "create_lead" && (result as { ok?: boolean }).ok) yield { type: "lead_created" };
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
    // Вызовы сверх лимита получают отказ, чтобы модель завершила ответ без них
    for (const call of calls.slice(allowed.length)) {
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ error: "Лимит вызовов исчерпан" }) });
    }

    usage.tools = toolCalls;
    previousId = responseId;
    input = outputs;
  }

  yield { type: "done", usage: { ...usage, tools: toolCalls } };
}
