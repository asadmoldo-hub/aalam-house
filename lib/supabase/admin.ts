import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Сервисный клиент: обходит RLS. Только для серверного кода с собственной валидацией
// (публичные данные лендинга, приём заявок, инструменты AI-агента).
export function createAdminClient() {
  const { url } = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY не задан");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
