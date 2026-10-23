"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/rate-limit";
import type { FormState } from "@/components/admin/ActionForm";

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Введите email и пароль" };

  // Защита от перебора: 10 попыток за 15 минут на email и на IP
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await allow(`login:${email}`, 10, 900)) || !(await allow(`login-ip:${ip}`, 30, 900))) {
    return { error: "Слишком много попыток входа. Подождите 15 минут." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Неверный email или пароль" };

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "У этой учётной записи нет доступа к CRM" };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 10) return { error: "Пароль должен быть не короче 10 символов" };
  if (password !== confirm) return { error: "Пароли не совпадают" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: "Пароль изменён" };
}
