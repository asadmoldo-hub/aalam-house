import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/admin/ActionForm";
import { BookingFields } from "@/components/admin/BookingFields";
import { createBooking } from "@/app/admin/actions/crm";

export const metadata: Metadata = { title: "Новое бронирование" };

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; client?: string; property?: string; in?: string; out?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: properties }, { data: clients }] = await Promise.all([
    supabase.from("properties").select("id, title, price, price_unit").neq("status", "archived").order("title"),
    supabase.from("clients").select("id, full_name, phone").order("full_name"),
  ]);

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/bookings">Бронирования</Link> / Новое
          </div>
          <h1>Новое бронирование</h1>
          {sp.lead && <p>Из заявки — после сохранения заявка получит статус «Бронь оформлена»</p>}
        </div>
      </div>
      {sp.lead && !sp.client && (
        <div className="a-alert warn" style={{ marginBottom: 16, maxWidth: 900 }}>
          У заявки ещё нет клиента. Откройте заявку и нажмите «Создать клиента», либо выберите существующего.
        </div>
      )}
      <section className="a-card a-card-pad" style={{ maxWidth: 900 }}>
        <ActionForm action={createBooking} submitLabel="Создать бронирование">
          <BookingFields
            b={{ lead_id: sp.lead, client_id: sp.client, property_id: sp.property, check_in: sp.in, check_out: sp.out }}
            properties={properties ?? []}
            clients={clients ?? []}
          />
        </ActionForm>
      </section>
    </>
  );
}
