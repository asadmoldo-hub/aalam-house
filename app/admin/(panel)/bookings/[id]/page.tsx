import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { BookingFields } from "@/components/admin/BookingFields";
import { deleteBooking, updateBooking } from "@/app/admin/actions/crm";
import { bookingStatusTone } from "@/lib/admin-ui";
import { bookingStatusLabel, formatDateTime, nightsBetween } from "@/lib/labels";
import type { Booking } from "@/lib/types";

export const metadata: Metadata = { title: "Бронирование" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("*, properties(id, title), clients(id, full_name)")
    .eq("id", id)
    .maybeSingle<Booking & { properties: { id: string; title: string } | null; clients: { id: string; full_name: string } | null }>();
  if (!b) notFound();

  const [{ data: properties }, { data: clients }] = await Promise.all([
    supabase.from("properties").select("id, title, price, price_unit").order("title"),
    supabase.from("clients").select("id, full_name, phone").order("full_name"),
  ]);

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/bookings">Бронирования</Link> / {b.properties?.title}
          </div>
          <h1 className="a-row">
            {b.properties?.title}
            <span className={`a-badge ${bookingStatusTone[b.status]}`}>{bookingStatusLabel[b.status]}</span>
          </h1>
          <p>
            {b.clients && <Link href={`/admin/clients/${b.clients.id}`}>{b.clients.full_name}</Link>} ·{" "}
            {nightsBetween(b.check_in, b.check_out)} ноч. · создано {formatDateTime(b.created_at)}
            {b.lead_id && (
              <>
                {" "}
                · <Link href={`/admin/leads/${b.lead_id}`}>заявка</Link>
              </>
            )}
          </p>
        </div>
      </div>
      <section className="a-card a-card-pad" style={{ maxWidth: 900 }}>
        <ActionForm action={updateBooking.bind(null, b.id)}>
          <BookingFields b={b} properties={properties ?? []} clients={clients ?? []} />
        </ActionForm>
        <div className="a-mt">
          <ConfirmButton
            action={deleteBooking.bind(null, b.id)}
            label="Удалить бронирование"
            confirmText="Удалить бронирование? Лучше перевести его в статус «Отменена», чтобы сохранить историю."
            className="a-btn a-btn-danger a-btn-sm"
          />
        </div>
      </section>
    </>
  );
}
