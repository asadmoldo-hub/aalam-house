import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Staff = { id: string; email: string; fullName: string; role: "admin" | "manager" };

// Возвращает сотрудника или отправляет на страницу входа. Пользователь Auth
// без строки в profiles сотрудником не считается.
export const requireStaff = cache(async (): Promise<Staff> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile) redirect("/admin/login?error=forbidden");

  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    fullName: profile.full_name,
    role: profile.role,
  };
});
