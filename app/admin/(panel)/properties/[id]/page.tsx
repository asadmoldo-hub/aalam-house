import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { PropertyFields } from "@/components/admin/fields";
import { deleteProperty, updateProperty } from "@/app/admin/actions/crm";
import { bookingStatusTone, propertyStatusLabel, propertyStatusTone } from "@/lib/admin-ui";
import { bookingStatusLabel, formatDate, formatMoney, todayIso } from "@/lib/labels";
import type { Booking, Property } from "@/lib/types";

export const metadata: Metadata = { title: "Объект" };

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("properties").select("*").eq("id", id).maybeSingle<Property>();
  if (!p) notFound();

  const [{ data: owners }, { data: bookings }, { count: leadCount }] = await Promise.all([
    supabase.from("clients").select("id, full_name").eq("kind", "owner").order("full_name"),
    supabase
      .from("bookings")
      .select("id, check_in, check_out, status, total_price, clients(full_name)")
      .eq("property_id", id)
      .gte("check_out", todayIso())
      .neq("status", "cancelled")
      .order("check_in")
      .returns<(Booking & { clients: { full_name: string } | null })[]>(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("property_id", id),
  ]);

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/properties">Объекты</Link> / {p.title}
          </div>
          <h1 className="a-row">
            {p.title}
            <span className={`a-badge ${propertyStatusTone[p.status]}`}>{propertyStatusLabel[p.status]}</span>
          </h1>
          <p>Заявок по объекту: {leadCount ?? 0}</p>
        </div>
        <Link className="a-btn a-btn-primary" href={`/admin/bookings/new?property=${p.id}`}>
          + Бронирование
        </Link>
      </div>

      <div className="a-grid a-2col">
        <section className="a-card a-card-pad">
          <ActionForm action={updateProperty.bind(null, p.id)}>
            <PropertyFields p={p} owners={owners ?? []} />
          </ActionForm>
          <div className="a-mt">
            <ConfirmButton
              action={deleteProperty.bind(null, p.id)}
              label="Удалить объект"
              confirmText="Удалить объект? Если есть бронирования, удаление будет запрещено — переведите объект в архив."
              className="a-btn a-btn-danger a-btn-sm"
            />
          </div>
        </section>

        <section className="a-card" style={{ alignSelf: "start" }}>
          <div className="a-card-head">
            <h2>Занятость</h2>
            <p>текущие и будущие брони</p>
          </div>
          {bookings?.length ? (
            <ul className="a-list">
              {bookings.map((b) => (
                <li key={b.id}>
                  <span>
                    <Link href={`/admin/bookings/${b.id}`}>
                      {formatDate(b.check_in)} – {formatDate(b.check_out)}
                    </Link>
                    <span className="a-muted" style={{ display: "block", fontSize: 12 }}>
                      {b.clients?.full_name} · {formatMoney(b.total_price)}
                    </span>
                  </span>
                  <span className={`a-badge ${bookingStatusTone[b.status]}`}>{bookingStatusLabel[b.status]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="a-empty">Свободен — броней нет</div>
          )}
        </section>
      </div>
    </>
  );
}
