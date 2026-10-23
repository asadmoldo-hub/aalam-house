import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { aiConfig } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { changePassword } from "@/app/admin/actions/auth";
import { createService, deleteService, updateChat, updateCompany, updateService } from "@/app/admin/actions/content";
import type { CompanySettings, Service } from "@/lib/types";

export const metadata: Metadata = { title: "Настройки" };

const tones = { cream: "Кремовый", sage: "Шалфей", rose: "Розовый" };

export default async function SettingsPage() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const supabase = await createClient();
  const [{ data: s }, { data: services }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("id", 1).single<CompanySettings>(),
    supabase.from("services").select("*").order("sort_order").returns<Service[]>(),
  ]);

  const integrations = [
    { name: "Supabase", ok: !!process.env.SUPABASE_SECRET_KEY, note: "база данных и авторизация" },
    {
      name: "OpenAI API",
      ok: aiConfig.configured,
      note: `чат и агент: ${aiConfig.chatModel} · эмбеддинги: ${aiConfig.embeddingModel} (переменная OPENAI_API_KEY)`,
    },
    { name: "Telegram-уведомления", ok: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), note: "необязательно" },
  ];

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Настройки</h1>
          <p>Данные компании, услуги и AI-помощник. Изменения сразу используются сайтом и чатом.</p>
        </div>
      </div>
      {!isAdmin && <div className="a-alert warn" style={{ marginBottom: 16 }}>Данные компании и чата может менять только администратор.</div>}

      <div className="a-grid a-2eq">
        <section className="a-card a-card-pad">
          <h2 style={{ marginBottom: 14 }}>Компания</h2>
          {s && (
            <ActionForm action={updateCompany}>
              <div className="a-form-grid">
                <Field name="name" label="Название *" value={s.name} />
                <Field name="phone" label="Телефон *" value={s.phone} />
                <Field name="email" label="Email *" value={s.email} />
                <Field name="hours" label="График работы *" value={s.hours} />
              </div>
              <Field name="tagline" label="Слоган *" value={s.tagline} />
              <Field name="address" label="Адрес офиса *" value={s.address} />
              <div className="a-form-grid">
                <Field name="whatsapp_url" label="WhatsApp (ссылка)" value={s.whatsapp_url} />
                <Field name="telegram_url" label="Telegram (ссылка)" value={s.telegram_url} />
                <Field name="instagram_url" label="Instagram (ссылка)" value={s.instagram_url} />
              </div>
              <label className="a-field">
                <span>О компании</span>
                <textarea className="a-textarea" name="about" defaultValue={s.about ?? ""} />
                <small>Это описание AI-помощник получает через get_business_info</small>
              </label>
            </ActionForm>
          )}
        </section>

        <div>
          <section className="a-card a-card-pad a-section">
            <h2 style={{ marginBottom: 14 }}>AI-помощник на сайте</h2>
            {s && (
              <ActionForm action={updateChat}>
                <label className="a-check">
                  <input type="checkbox" name="chat_enabled" defaultChecked={s.chat_enabled} />
                  Чат включён на сайте
                </label>
                <p className="a-muted">
                  Модель: <b>{aiConfig.chatModel}</b> (OpenAI Responses API). Меняется переменной OPENAI_MODEL.
                </p>
                <Field name="chat_greeting" label="Приветствие *" value={s.chat_greeting} />
                <label className="a-field">
                  <span>Дополнительные инструкции</span>
                  <textarea
                    className="a-textarea"
                    name="chat_instructions"
                    maxLength={4000}
                    defaultValue={s.chat_instructions ?? ""}
                    placeholder="Например: летом в первую очередь предлагай объекты на северном берегу"
                  />
                  <small>Факты (цены, условия) добавляйте в базу знаний и каталог, а не сюда</small>
                </label>
              </ActionForm>
            )}
          </section>

          <section className="a-card a-card-pad a-section">
            <h2 style={{ marginBottom: 10 }}>Интеграции</h2>
            <ul className="a-list" style={{ margin: "0 -20px" }}>
              {integrations.map((i) => (
                <li key={i.name}>
                  <span>
                    <b>{i.name}</b>
                    <span className="a-muted" style={{ display: "block", fontSize: 12 }}>
                      {i.note}
                    </span>
                  </span>
                  <span className={`a-badge ${i.ok ? "tone-green" : "tone-gray"}`}>{i.ok ? "настроено" : "не настроено"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="a-card a-card-pad a-section">
            <h2 style={{ marginBottom: 14 }}>Смена пароля</h2>
            <ActionForm action={changePassword} submitLabel="Сменить пароль">
              <div className="a-form-grid">
                <label className="a-field">
                  <span>Новый пароль</span>
                  <input className="a-input" type="password" name="password" minLength={10} autoComplete="new-password" required />
                </label>
                <label className="a-field">
                  <span>Повторите</span>
                  <input className="a-input" type="password" name="confirm" minLength={10} autoComplete="new-password" required />
                </label>
              </div>
            </ActionForm>
          </section>
        </div>
      </div>

      <section className="a-card a-mt">
        <div className="a-card-head">
          <h2>Услуги на сайте</h2>
          <p>видны в блоке «Что мы предлагаем» и AI-помощнику</p>
        </div>
        <div className="a-card-pad" style={{ display: "grid", gap: 16 }}>
          {(services ?? []).map((sv) => (
            <details key={sv.id} className="a-card" style={{ boxShadow: "none" }}>
              <summary className="a-card-pad a-row" style={{ cursor: "pointer", justifyContent: "space-between" }}>
                <span>
                  <b>{sv.title}</b> <span className="a-muted">· {sv.kicker}</span>
                </span>
                <span className={`a-badge ${sv.is_active ? "tone-green" : "tone-gray"}`}>{sv.is_active ? "показывается" : "скрыта"}</span>
              </summary>
              <div className="a-card-pad" style={{ borderTop: "1px solid var(--a-border)" }}>
                <ActionForm action={updateService.bind(null, sv.id)}>
                  <ServiceFields s={sv} />
                </ActionForm>
                <div className="a-mt">
                  <ConfirmButton action={deleteService.bind(null, sv.id)} label="Удалить услугу" confirmText="Удалить услугу?" className="a-btn a-btn-danger a-btn-sm" />
                </div>
              </div>
            </details>
          ))}
          <details className="a-card" style={{ boxShadow: "none" }}>
            <summary className="a-card-pad" style={{ cursor: "pointer" }}>
              <b>+ Добавить услугу</b>
            </summary>
            <div className="a-card-pad" style={{ borderTop: "1px solid var(--a-border)" }}>
              <ActionForm action={createService} submitLabel="Добавить">
                <ServiceFields />
              </ActionForm>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

function Field({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <label className="a-field">
      <span>{label}</span>
      <input className="a-input" name={name} defaultValue={value ?? ""} />
    </label>
  );
}

function ServiceFields({ s }: { s?: Service }) {
  return (
    <>
      <div className="a-form-grid">
        <Field name="title" label="Название *" value={s?.title ?? ""} />
        <Field name="kicker" label="Рубрика *" value={s?.kicker ?? ""} />
        <label className="a-field">
          <span>Цвет карточки</span>
          <select className="a-select" name="tone" defaultValue={s?.tone ?? "cream"}>
            {Object.entries(tones).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <Field name="sort_order" label="Порядок" value={String(s?.sort_order ?? 0)} />
      </div>
      <label className="a-field">
        <span>Описание *</span>
        <textarea className="a-textarea" name="description" maxLength={1000} defaultValue={s?.description ?? ""} />
      </label>
      <label className="a-check">
        <input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} />
        Показывать на сайте
      </label>
    </>
  );
}
