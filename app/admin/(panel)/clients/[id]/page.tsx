import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { ClientFields } from "@/components/admin/fields";
import { deleteClientRecord, updateClientRecord } from "@/app/admin/actions/crm";
import { bookingStatusTone, leadStatusTone } from "@/lib/admin-ui";
import { bookingStatusLabel, clientKindLabel, formatDate, formatDateTime, formatMoney, leadSourceLabel, leadStatusLabel } from "@/lib/labels";
import type { Booking, Client, Lead } from "@/lib/types";

export const metadata: Metadata = { title: "Клиент" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<Client>();
  if (!client) notFound();

  const [{ data: leads }, { data: bookings }, { data: owned }] = await Promise.all([
    supabase.from("leads").select("id, topic, message, source, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).returns<Lead[]>(),
    supabase
      .from("bookings")
      .select("id, check_in, check_out, status, total_price, properties(title)")
      .eq("client_id", id)
      .order("check_in", { ascending: false })
      .returns<(Booking & { properties: { title: string } | null })[]>(),
    supabase.from("properties").select("id, title").eq("owner_id", id),
  ]);

  const spent = (bookings ?? []).filter((b) => b.status !== "cancelled").reduce((s, b) => s + Number(b.total_price ?? 0), 0);

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/clients">Клиенты</Link> / {client.full_name}
          </div>
          <h1 className="a-row">
            {client.full_name}
            <span className="a-badge tone-gray plain">{clientKindLabel[client.kind]}</span>
          </h1>
          <p>
            В базе с {formatDate(client.created_at)} · броней: {bookings?.length ?? 0} · сумма: {formatMoney(spent)}
          </p>
        </div>
        <Link className="a-btn a-btn-primary" href={`/admin/bookings/new?client=${client.id}`}>
          + Бронирование
        </Link>
      </div>

      <div className="a-grid a-2col">
        <div>
          <section className="a-card a-section">
            <div className="a-card-head">
              <h2>История обращений</h2>
              <p>{leads?.length ?? 0}</p>
            </div>
            {leads?.length ? (
              <ul className="a-list">
                {leads.map((l) => (
                  <li key={l.id}>
                    <span>
                      <Link href={`/admin/leads/${l.id}`}>{l.topic ?? "Заявка"}</Link>
                      <span className="a-muted" style={{ display: "block", fontSize: 12 }}>
                        {leadSourceLabel[l.source]} · {formatDateTime(l.created_at)}
                      </span>
                    </span>
                    <span className={`a-badge ${leadStatusTone[l.status]}`}>{leadStatusLabel[l.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="a-empty">Обращений нет</div>
            )}
          </section>

          <section className="a-card a-section">
            <div className="a-card-head">
              <h2>Бронирования</h2>
              <p>{bookings?.length ?? 0}</p>
            </div>
            {bookings?.length ? (
              <ul className="a-list">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <span>
                      <Link href={`/admin/bookings/${b.id}`}>{b.properties?.title ?? "Объект"}</Link>
                      <span className="a-muted" style={{ display: "block", fontSize: 12 }}>
                        {formatDate(b.check_in)} – {formatDate(b.check_out)} · {formatMoney(b.total_price)}
                      </span>
                    </span>
                    <span className={`a-badge ${bookingStatusTone[b.status]}`}>{bookingStatusLabel[b.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="a-empty">Бронирований нет</div>
            )}
          </section>

          {owned && owned.length > 0 && (
            <section className="a-card a-section">
              <div className="a-card-head">
                <h2>Объекты владельца</h2>
              </div>
              <ul className="a-list">
                {owned.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/properties/${p.id}`}>{p.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="a-card a-card-pad" style={{ alignSelf: "start" }}>
          <h2 style={{ marginBottom: 14 }}>Карточка клиента</h2>
          <ActionForm action={updateClientRecord.bind(null, client.id)}>
            <ClientFields c={client} />
          </ActionForm>
          <div className="a-mt">
            <ConfirmButton
              action={deleteClientRecord.bind(null, client.id)}
              label="Удалить клиента"
              confirmText="Удалить клиента? Заявки останутся, но потеряют связь с ним."
              className="a-btn a-btn-danger a-btn-sm"
            />
          </div>
        </section>
      </div>
    </>
  );
}
