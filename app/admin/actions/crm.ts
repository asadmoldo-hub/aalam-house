"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bool, dbError, field, num, optional } from "@/lib/form-data";
import { nightsBetween } from "@/lib/labels";
import { phoneRe } from "@/lib/leads";
import type { FormState } from "@/components/admin/ActionForm";

const toast = (path: string, text: string) => `${path}?toast=${encodeURIComponent(text)}`;
const uuidOrNull = (v: string | null) => (v && z.uuid().safeParse(v).success ? v : null);

async function db() {
  await requireStaff();
  return createClient();
}

// ───────────────── Заявки ─────────────────

const leadStatuses = ["new", "in_progress", "qualified", "converted", "lost"] as const;

export async function updateLead(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const status = field(fd, "status");
  if (!leadStatuses.includes(status as (typeof leadStatuses)[number])) return { error: "Неизвестный статус" };
  const supabase = await db();
  const { error } = await supabase
    .from("leads")
    .update({
      status,
      assigned_to: uuidOrNull(optional(fd, "assigned_to")),
      property_id: uuidOrNull(optional(fd, "property_id")),
      manager_notes: optional(fd, "manager_notes"),
    })
    .eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: "Заявка сохранена" };
}

export async function createManualLead(_: FormState, fd: FormData): Promise<FormState> {
  const name = field(fd, "name");
  const phone = field(fd, "phone");
  if (!name) return { error: "Укажите имя" };
  if (!phoneRe.test(phone)) return { error: "Телефон в формате +996 555 123 456" };
  const supabase = await db();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name,
      phone,
      email: optional(fd, "email"),
      topic: optional(fd, "topic"),
      message: optional(fd, "message"),
      source: field(fd, "source") === "phone" ? "phone" : "manual",
      property_id: uuidOrNull(optional(fd, "property_id")),
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin", "layout");
  redirect(toast(`/admin/leads/${data.id}`, "Заявка создана"));
}

export async function deleteLead(id: string) {
  const supabase = await db();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) redirect(`/admin/leads/${id}?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/admin", "layout");
  redirect(toast("/admin/leads", "Заявка удалена"));
}

// Создаёт клиента из заявки (или находит по телефону) и связывает их
export async function convertLeadToClient(id: string) {
  const supabase = await db();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) redirect(`/admin/leads?err=${encodeURIComponent("Заявка не найдена")}`);

  let clientId: string | null = lead.client_id;
  if (!clientId) {
    const { data: existing } = await supabase.from("clients").select("id").eq("phone", lead.phone).limit(1).maybeSingle();
    clientId = existing?.id ?? null;
  }
  if (!clientId) {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        kind: lead.topic?.toLowerCase().includes("сдать") ? "owner" : "guest",
        notes: lead.message,
      })
      .select("id")
      .single();
    if (error) redirect(`/admin/leads/${id}?err=${encodeURIComponent(dbError(error.message))}`);
    clientId = created.id;
  }
  await supabase
    .from("leads")
    .update({ client_id: clientId, status: lead.status === "new" ? "in_progress" : lead.status })
    .eq("id", id);
  revalidatePath("/admin", "layout");
  redirect(toast(`/admin/clients/${clientId}`, "Клиент привязан к заявке"));
}

// ───────────────── Клиенты ─────────────────

const clientKinds = ["guest", "tenant", "owner", "business"] as const;
const clientSources = ["website_form", "ai_chat", "phone", "referral", "manual"] as const;

function clientPayload(fd: FormData) {
  const full_name = field(fd, "full_name");
  const phone = optional(fd, "phone");
  const email = optional(fd, "email");
  const kind = field(fd, "kind");
  const source = field(fd, "source") || "manual";
  if (!full_name) return { error: "Укажите имя клиента" };
  if (phone && !phoneRe.test(phone)) return { error: "Телефон в формате +996 555 123 456" };
  if (email && !z.email().safeParse(email).success) return { error: "Некорректный email" };
  if (!clientKinds.includes(kind as (typeof clientKinds)[number])) return { error: "Выберите тип клиента" };
  if (!clientSources.includes(source as (typeof clientSources)[number])) return { error: "Неизвестный источник" };
  return {
    data: { full_name, phone, email, telegram: optional(fd, "telegram"), kind, source, notes: optional(fd, "notes") },
  };
}

export async function createClientRecord(_: FormState, fd: FormData): Promise<FormState> {
  const p = clientPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await db();
  const { data, error } = await supabase.from("clients").insert(p.data!).select("id").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin", "layout");
  redirect(toast(`/admin/clients/${data.id}`, "Клиент создан"));
}

export async function updateClientRecord(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = clientPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await db();
  const { error } = await supabase.from("clients").update(p.data!).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: "Изменения сохранены" };
}

export async function deleteClientRecord(id: string) {
  const supabase = await db();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) redirect(`/admin/clients/${id}?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/admin", "layout");
  redirect(toast("/admin/clients", "Клиент удалён"));
}

// ───────────────── Объекты ─────────────────

const propertyKinds = ["apartment", "house", "cottage", "guest_house", "camp", "office", "commercial"] as const;
const regions = ["issyk_kul_north", "issyk_kul_south", "bishkek", "osh", "other"] as const;

function propertyPayload(fd: FormData) {
  const title = field(fd, "title");
  const kind = field(fd, "kind");
  const region = field(fd, "region");
  const location = field(fd, "location");
  const price = num(fd, "price");
  const max_guests = num(fd, "max_guests");
  const sort_order = num(fd, "sort_order") ?? 0;
  const price_unit = field(fd, "price_unit");
  const status = field(fd, "status");
  if (title.length < 2) return { error: "Название слишком короткое" };
  if (!propertyKinds.includes(kind as (typeof propertyKinds)[number])) return { error: "Выберите тип объекта" };
  if (!regions.includes(region as (typeof regions)[number])) return { error: "Выберите регион" };
  if (location.length < 2) return { error: "Укажите расположение" };
  if (price == null || Number.isNaN(price) || price < 0) return { error: "Укажите цену числом" };
  if (max_guests != null && (Number.isNaN(max_guests) || max_guests < 1)) return { error: "Число гостей — целое число от 1" };
  if (!["night", "month"].includes(price_unit)) return { error: "Выберите единицу цены" };
  if (!["active", "hidden", "archived"].includes(status)) return { error: "Выберите статус" };
  return {
    data: {
      title,
      kind,
      region,
      location,
      description: optional(fd, "description"),
      capacity: optional(fd, "capacity"),
      max_guests: max_guests == null ? null : Math.round(max_guests),
      price,
      price_unit,
      status,
      is_featured: bool(fd, "is_featured"),
      sort_order: Number.isNaN(sort_order) ? 0 : Math.round(sort_order),
      features: field(fd, "features")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
      owner_id: uuidOrNull(optional(fd, "owner_id")),
    },
  };
}

export async function createProperty(_: FormState, fd: FormData): Promise<FormState> {
  const p = propertyPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await db();
  const { data, error } = await supabase.from("properties").insert(p.data!).select("id").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect(toast(`/admin/properties/${data.id}`, "Объект создан"));
}

export async function updateProperty(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = propertyPayload(fd);
  if (p.error) return { error: p.error };
  const supabase = await db();
  const { error } = await supabase.from("properties").update(p.data!).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return { ok: "Объект сохранён. Изменения видны на сайте и AI-помощнику." };
}

export async function deleteProperty(id: string) {
  const supabase = await db();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) redirect(`/admin/properties/${id}?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect(toast("/admin/properties", "Объект удалён"));
}

// ───────────────── Бронирования ─────────────────

const bookingStatuses = ["pending", "confirmed", "checked_in", "completed", "cancelled"] as const;

async function bookingPayload(fd: FormData, supabase: Awaited<ReturnType<typeof createClient>>) {
  const property_id = uuidOrNull(optional(fd, "property_id"));
  const client_id = uuidOrNull(optional(fd, "client_id"));
  const check_in = field(fd, "check_in");
  const check_out = field(fd, "check_out");
  const status = field(fd, "status") || "pending";
  const guests = num(fd, "guests");
  let total_price = num(fd, "total_price");
  if (!property_id) return { error: "Выберите объект" };
  if (!client_id) return { error: "Выберите клиента" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out)) return { error: "Укажите даты" };
  if (check_out <= check_in) return { error: "Дата выезда должна быть позже даты заезда" };
  if (!bookingStatuses.includes(status as (typeof bookingStatuses)[number])) return { error: "Неизвестный статус" };
  if (guests != null && (Number.isNaN(guests) || guests < 1)) return { error: "Число гостей — целое число от 1" };
  if (total_price != null && (Number.isNaN(total_price) || total_price < 0)) return { error: "Сумма — неотрицательное число" };

  // Если сумма не указана — считаем по цене объекта
  if (total_price == null) {
    const { data: prop } = await supabase.from("properties").select("price, price_unit").eq("id", property_id).single();
    if (prop) {
      const nights = nightsBetween(check_in, check_out);
      total_price =
        prop.price_unit === "night"
          ? nights * Number(prop.price)
          : Math.round((nights / 30) * Number(prop.price));
    }
  }
  return {
    data: {
      property_id,
      client_id,
      lead_id: uuidOrNull(optional(fd, "lead_id")),
      check_in,
      check_out,
      guests: guests == null ? null : Math.round(guests),
      total_price,
      status,
      notes: optional(fd, "notes"),
    },
  };
}

export async function createBooking(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await db();
  const p = await bookingPayload(fd, supabase);
  if (p.error) return { error: p.error };
  const { data, error } = await supabase.from("bookings").insert(p.data!).select("id").single();
  if (error) return { error: dbError(error.message) };
  if (p.data!.lead_id) {
    await supabase.from("leads").update({ status: "converted", client_id: p.data!.client_id }).eq("id", p.data!.lead_id);
  }
  revalidatePath("/admin", "layout");
  redirect(toast(`/admin/bookings/${data.id}`, "Бронирование создано"));
}

export async function updateBooking(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const supabase = await db();
  const p = await bookingPayload(fd, supabase);
  if (p.error) return { error: p.error };
  const { error } = await supabase.from("bookings").update(p.data!).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: "Бронирование сохранено" };
}

export async function deleteBooking(id: string) {
  const supabase = await db();
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) redirect(`/admin/bookings/${id}?err=${encodeURIComponent(dbError(error.message))}`);
  revalidatePath("/admin", "layout");
  redirect(toast("/admin/bookings", "Бронирование удалено"));
}
