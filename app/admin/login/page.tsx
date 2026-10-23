import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { signIn, signOut } from "@/app/admin/actions/auth";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="a-login">
      <div className="a-card">
        <span className="a-brand-mark" style={{ width: 40, height: 40, color: "#fff", fontWeight: 700 }}>
          А
        </span>
        <h1>Вход в CRM</h1>
        <p className="muted">Аалам Хаус · только для сотрудников</p>
        {error === "forbidden" && (
          <div className="a-alert warn" style={{ marginBottom: 14 }}>
            У этой учётной записи нет доступа к CRM.
            <form action={signOut} style={{ marginTop: 6 }}>
              <button className="a-btn a-btn-sm" type="submit">
                Выйти из учётной записи
              </button>
            </form>
          </div>
        )}
        <ActionForm action={signIn} submitLabel="Войти">
          <label className="a-field">
            <span>Email</span>
            <input className="a-input" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="a-field">
            <span>Пароль</span>
            <input className="a-input" name="password" type="password" autoComplete="current-password" required />
          </label>
        </ActionForm>
      </div>
    </main>
  );
}
