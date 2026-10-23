// Создаёт (или сбрасывает пароль) сотрудника CRM. Запуск только локально, с секретным ключом:
//   node --env-file=.env.local scripts/create-admin.mjs <email> "<Имя>" [admin|manager]
// Пароль генерируется случайно и записывается в файл в домашней папке, в консоль не выводится.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [email, fullName, role = "admin"] = process.argv.slice(2);
if (!email || !fullName || !["admin", "manager"].includes(role)) {
  console.error('Использование: node --env-file=.env.local scripts/create-admin.mjs <email> "<Имя>" [admin|manager]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Нет SUPABASE_URL или SUPABASE_SECRET_KEY в окружении");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const password = randomBytes(18).toString("base64url");

let userId;
const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  // Пользователь уже есть — находим и сбрасываем пароль
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;
  userId = existing.id;
  const { error: updErr } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (updErr) throw updErr;
} else {
  userId = created.user.id;
}

const { error: profErr } = await db.from("profiles").upsert({ id: userId, full_name: fullName, role });
if (profErr) throw profErr;

const file = join(homedir(), "aalam-crm-admin.txt");
writeFileSync(
  file,
  `CRM Аалам Хаус\nВход: /admin/login\nEmail: ${email}\nПароль: ${password}\nРоль: ${role}\n\nСмените пароль в CRM → Настройки и удалите этот файл.\n`,
  { mode: 0o600 },
);
console.log(`Готово: ${email} (${role}). Пароль записан в ${file}`);
