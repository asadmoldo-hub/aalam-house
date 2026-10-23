"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bool, dbError, field, num, optional } from "@/lib/form-data";
import { indexDocument } from "@/lib/kb";
import type { FormState } from "@/components/admin/ActionForm";

const toast = (path: string, text: string) => `${path}?toast=${encodeURIComponent(text)}`;
const kbKinds = ["company", "faq", "service", "policy", "article", "document"] as const;
const MAX_FILE = 4 * 1024 * 1024;

async function readUpload(file: File): Promise<{ text?: string; error?: string }> {
  if (file.size > MAX_FILE) return { error: "Файл больше 4 МБ" };
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) return { text: await file.text() };
  if (name.endsWith(".pdf")) {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      if (!text.trim()) return { error: "В PDF нет текстового слоя (скан). Загрузите текстовую версию." };
      return { text };
    } catch {
      return { error: "Не удалось прочитать PDF" };
    }
  }
  return { error: "Поддерживаются файлы .txt, .md и .pdf" };
}

function indexMessage(r: { chunks: number; embedded: number; newlyEmbedded: number; embedError: string | null }) {
  return r.embedError
    ? `Сохранено, ${r.chunks} фрагм. OpenAI недоступен (${r.embedError.slice(0, 80)}) — работает полнотекстовый поиск.`
    : `Проиндексировано: ${r.chunks} фрагм., новых эмбеддингов ${r.newlyEmbedded}, переиспользовано ${r.embedded - r.newlyEmbedded}.`;
}

async function kbPayload(fd: FormData) {
  const title = field(fd, "title");
  const kind = field(fd, "kind");
  let content = field(fd, "content");
  let source_filename: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const r = await readUpload(file);
    if (r.error) return { error: r.error };
    content = [content, r.text!.trim()].filter(Boolean).join("\n\n");
    source_filename = file.name;
  }
  if (title.length < 2) return { error: "Укажите заголовок" };
  if (!kbKinds.includes(kind as (typeof kbKinds)[number])) return { error: "Выберите тип материала" };
  if (!content) return { error: "Добавьте текст или загрузите файл" };
  if (content.length > 200_000) return { error: "Текст слишком длинный (больше 200 000 символов)" };
  return { data: { title, kind, content, is_published: bool(fd, "is_published"), ...(source_filename ? { source_filename } : {}) } };
}

export async function createKbDocument(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const p = await kbPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("kb_documents").insert(p.data!).select("id").single();
  if (error) return { error: dbError(error.message) };
  const r = await indexDocument(data.id);
  revalidatePath("/admin/knowledge");
  redirect(toast(`/admin/knowledge/${data.id}`, indexMessage(r)));
}

export async function updateKbDocument(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const p = await kbPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.from("kb_documents").update(p.data!).eq("id", id);
  if (error) return { error: dbError(error.message) };
  const r = await indexDocument(id);
  revalidatePath("/admin/knowledge");
  return { ok: indexMessage(r) };
}

export async function deleteKbDocument(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("kb_documents").delete().eq("id", id);
  if (error) redirect(`/admin/knowledge/${id}?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/admin/knowledge");
  redirect(toast("/admin/knowledge", "Материал удалён"));
}

export async function reindexAll() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("kb_documents").select("id");
  let chunks = 0;
  let embedded = 0;
  for (const d of data ?? []) {
    const r = await indexDocument(d.id);
    chunks += r.chunks;
    embedded += r.embedded;
  }
  revalidatePath("/admin/knowledge");
  redirect(toast("/admin/knowledge", `Индекс обновлён: ${chunks} фрагм., с эмбеддингами — ${embedded}`));
}

// ───────────────── Настройки ─────────────────

export async function updateCompany(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (staff.role !== "admin") return { error: "Менять настройки может только администратор" };
  const required = ["name", "tagline", "phone", "email", "address", "hours"] as const;
  for (const k of required) if (!field(fd, k)) return { error: "Заполните все обязательные поля" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      name: field(fd, "name"),
      tagline: field(fd, "tagline"),
      phone: field(fd, "phone"),
      email: field(fd, "email"),
      address: field(fd, "address"),
      hours: field(fd, "hours"),
      whatsapp_url: optional(fd, "whatsapp_url"),
      telegram_url: optional(fd, "telegram_url"),
      instagram_url: optional(fd, "instagram_url"),
      about: optional(fd, "about"),
    })
    .eq("id", 1);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  return { ok: "Данные компании сохранены. Сайт и AI-помощник используют новые значения." };
}

export async function updateChat(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (staff.role !== "admin") return { error: "Менять настройки может только администратор" };
  const greeting = field(fd, "chat_greeting");
  if (!greeting) return { error: "Укажите приветствие" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      chat_enabled: bool(fd, "chat_enabled"),
      chat_greeting: greeting,
      chat_instructions: optional(fd, "chat_instructions"),
    })
    .eq("id", 1);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  return { ok: "Настройки чата сохранены" };
}

function servicePayload(fd: FormData) {
  const title = field(fd, "title");
  const kicker = field(fd, "kicker");
  const description = field(fd, "description");
  const tone = field(fd, "tone");
  const sort_order = num(fd, "sort_order") ?? 0;
  if (!title || !kicker || !description) return { error: "Заполните название, рубрику и описание" };
  if (!["cream", "sage", "rose"].includes(tone)) return { error: "Выберите цвет карточки" };
  return {
    data: { title, kicker, description, tone, sort_order: Number.isNaN(sort_order) ? 0 : Math.round(sort_order), is_active: bool(fd, "is_active") },
  };
}

export async function createService(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const p = servicePayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.from("services").insert(p.data!);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  redirect(toast("/admin/settings", "Услуга добавлена"));
}

export async function updateService(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const p = servicePayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(p.data!).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  return { ok: "Услуга сохранена" };
}

export async function deleteService(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) redirect(`/admin/settings?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/");
  redirect(toast("/admin/settings", "Услуга удалена"));
}
