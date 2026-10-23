import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/admin/ActionForm";
import { createManualLead } from "@/app/admin/actions/crm";

export const metadata: Metadata = { title: "Новая заявка" };

export default async function NewLeadPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase.from("properties").select("id, title").neq("status", "archived").order("title");

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/leads">Заявки</Link> / Новая
          </div>
          <h1>Заявка вручную</h1>
          <p>Например, после входящего звонка</p>
        </div>
      </div>
      <section className="a-card a-card-pad" style={{ maxWidth: 760 }}>
        <ActionForm action={createManualLead} submitLabel="Создать заявку">
          <div className="a-form-grid">
            <label className="a-field">
              <span>Имя *</span>
              <input className="a-input" name="name" required maxLength={120} />
            </label>
            <label className="a-field">
              <span>Телефон *</span>
              <input className="a-input" name="phone" required placeholder="+996 555 123 456" />
            </label>
            <label className="a-field">
              <span>Email</span>
              <input className="a-input" name="email" type="email" />
            </label>
            <label className="a-field">
              <span>Источник</span>
              <select className="a-select" name="source" defaultValue="phone">
                <option value="phone">Звонок</option>
                <option value="manual">Другое</option>
              </select>
            </label>
            <label className="a-field">
              <span>Объект</span>
              <select className="a-select" name="property_id" defaultValue="">
                <option value="">— не выбран —</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Тема</span>
              <input className="a-input" name="topic" maxLength={160} placeholder="Жильё на Иссык-Куле на отдых" />
            </label>
          </div>
          <label className="a-field">
            <span>Сообщение</span>
            <textarea className="a-textarea" name="message" maxLength={2000} placeholder="Даты, число гостей, бюджет" />
          </label>
        </ActionForm>
      </section>
    </>
  );
}
