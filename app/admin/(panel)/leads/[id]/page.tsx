import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { convertLeadToClient, deleteLead, updateLead } from "@/app/admin/actions/crm";
import { leadSourceTone, leadStatusTone } from "@/lib/admin-ui";
import { formatDate, formatDateTime, leadSourceLabel, leadStatusLabel } from "@/lib/labels";
import type { Lead } from "@/lib/types";

export const metadata: Metadata = { title: "Заявка" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*, properties(id, title), clients(id, full_name)")
    .eq("id", id)
    .maybeSingle<Lead & { properties: { id: string; title: string } | null; clients: { id: string; full_name: string } | null }>();
  if (!lead) notFound();

  const [{ data: staff }, { data: properties }, { data: session }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("properties").select("id, title").neq("status", "archived").order("title"),
    lead.chat_session_id
      ? supabase.from("chat_sessions").select("transcript").eq("id", lead.chat_session_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("activities").select("id, action, details, created_at").eq("entity", "lead").eq("entity_id", id).order("created_at"),
  ]);

  const transcript = (session?.transcript ?? []) as { role: string; text: string; at: string }[];
  const bookingHref = `/admin/bookings/new?lead=${lead.id}${lead.client_id ? `&client=${lead.client_id}` : ""}${
    lead.property_id ? `&property=${lead.property_id}` : ""
  }${lead.check_in ? `&in=${lead.check_in}` : ""}${lead.check_out ? `&out=${lead.check_out}` : ""}`;

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/leads">Заявки</Link> / {lead.name}
          </div>
          <h1 className="a-row">
            {lead.name}
            <span className={`a-badge ${leadStatusTone[lead.status]}`}>{leadStatusLabel[lead.status]}</span>
            <span className={`a-badge ${leadSourceTone[lead.source]}`}>{leadSourceLabel[lead.source]}</span>
          </h1>
          <p>Создана {formatDateTime(lead.created_at)}</p>
        </div>
        <div className="a-actions">
          {lead.clients ? (
            <Link className="a-btn" href={`/admin/clients/${lead.clients.id}`}>
              Клиент: {lead.clients.full_name}
            </Link>
          ) : (
            <form action={convertLeadToClient.bind(null, lead.id)}>
              <button className="a-btn" type="submit">
                Создать клиента
              </button>
            </form>
          )}
          <Link className="a-btn a-btn-primary" href={bookingHref}>
            Оформить бронь
          </Link>
        </div>
      </div>

      <div className="a-grid a-2col">
        <div>
          <section className="a-card a-section">
            <div className="a-card-head">
              <h2>Данные заявки</h2>
            </div>
            <div className="a-card-pad">
              <dl className="a-dl">
                <dt>Телефон</dt>
                <dd>
                  <a href={`tel:${lead.phone.replace(/[^+0-9]/g, "")}`}>{lead.phone}</a>
                </dd>
                <dt>Email</dt>
                <dd>{lead.email ?? "—"}</dd>
                <dt>Тема</dt>
                <dd>{lead.topic ?? "—"}</dd>
                <dt>Объект</dt>
                <dd>{lead.properties ? <Link href={`/admin/properties/${lead.properties.id}`}>{lead.properties.title}</Link> : "—"}</dd>
                <dt>Даты</dt>
                <dd>{lead.check_in ? `${formatDate(lead.check_in)} – ${formatDate(lead.check_out)}` : "—"}</dd>
                <dt>Гостей</dt>
                <dd>{lead.guests ?? "—"}</dd>
                <dt>Сообщение</dt>
                <dd className="a-pre">{lead.message ?? "—"}</dd>
              </dl>
            </div>
          </section>

          {transcript.length > 0 && (
            <section className="a-card a-section">
              <div className="a-card-head">
                <h2>Переписка с AI-помощником</h2>
                <p>{transcript.length} сообщ.</p>
              </div>
              <div className="a-chat">
                {transcript.map((m, i) => (
                  <div key={i} className={`m ${m.role}`}>
                    {m.text || <i className="a-muted">(действие без текста)</i>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="a-card a-section">
            <div className="a-card-head">
              <h2>История</h2>
            </div>
            <ul className="a-list">
              {(history ?? []).map((h) => {
                const d = h.details as Record<string, string>;
                return (
                  <li key={h.id}>
                    <span>
                      {h.action === "created"
                        ? "Заявка создана"
                        : `Статус: ${leadStatusLabel[d.from as Lead["status"]]} → ${leadStatusLabel[d.to as Lead["status"]]}`}
                    </span>
                    <span className="meta">{formatDateTime(h.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section className="a-card a-card-pad" style={{ alignSelf: "start" }}>
          <h2 style={{ marginBottom: 14 }}>Обработка</h2>
          <ActionForm action={updateLead.bind(null, lead.id)}>
            <label className="a-field">
              <span>Статус</span>
              <select className="a-select" name="status" defaultValue={lead.status}>
                {Object.entries(leadStatusLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Ответственный</span>
              <select className="a-select" name="assigned_to" defaultValue={lead.assigned_to ?? ""}>
                <option value="">— не назначен —</option>
                {staff?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Объект</span>
              <select className="a-select" name="property_id" defaultValue={lead.property_id ?? ""}>
                <option value="">— не выбран —</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Заметки менеджера</span>
              <textarea className="a-textarea" name="manager_notes" defaultValue={lead.manager_notes ?? ""} maxLength={5000} />
            </label>
          </ActionForm>
          <div className="a-mt">
            <ConfirmButton
              action={deleteLead.bind(null, lead.id)}
              label="Удалить заявку"
              confirmText="Удалить заявку без возможности восстановления?"
              className="a-btn a-btn-danger a-btn-sm"
            />
          </div>
        </section>
      </div>
    </>
  );
}
