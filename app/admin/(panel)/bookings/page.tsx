import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Row } from "@/components/admin/DataTable";
import { bookingStatusTone, options } from "@/lib/admin-ui";
import { bookingStatusLabel, formatDate, formatMoney, nightsBetween, todayIso } from "@/lib/labels";
import type { Booking } from "@/lib/types";

export const metadata: Metadata = { title: "Бронирования" };

type BookingRow = Booking & { properties: { title: string } | null; clients: { full_name: string; phone: string | null } | null };

export default async function BookingsPage() {
  const supabase = await createClient();
  const today = todayIso();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, properties(title), clients(full_name, phone)")
    .order("check_in", { ascending: false })
    .limit(2000)
    .returns<BookingRow[]>();

  const rows: Row[] = (data ?? []).map((b) => {
    const period = b.check_out < today ? "past" : b.check_in <= today ? "now" : "future";
    return {
      id: b.id,
      href: `/admin/bookings/${b.id}`,
      search: [b.properties?.title, b.clients?.full_name, b.clients?.phone, b.notes].filter(Boolean).join(" "),
      filters: { status: b.status, period },
      sort: { checkin: b.check_in, property: b.properties?.title ?? "", total: Number(b.total_price ?? 0), status: b.status },
      cells: {
        property: { text: b.properties?.title ?? "—" },
        client: { text: b.clients?.full_name ?? "—", sub: b.clients?.phone ?? undefined },
        checkin: { text: `${formatDate(b.check_in)} – ${formatDate(b.check_out)}`, sub: `${nightsBetween(b.check_in, b.check_out)} ноч.` },
        total: { text: formatMoney(b.total_price) },
        status: { text: bookingStatusLabel[b.status], badge: bookingStatusTone[b.status] },
      },
    };
  });

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Бронирования</h1>
          <p>Пересечение дат по одному объекту запрещено на уровне базы данных</p>
        </div>
        <Link className="a-btn a-btn-primary" href="/admin/bookings/new">
          + Бронирование
        </Link>
      </div>
      {error && <div className="a-alert err">Не удалось загрузить бронирования: {error.message}</div>}
      <DataTable
        rows={rows}
        columns={[
          { key: "property", label: "Объект" },
          { key: "client", label: "Клиент", sortable: false },
          { key: "checkin", label: "Даты" },
          { key: "total", label: "Сумма", num: true },
          { key: "status", label: "Статус" },
        ]}
        filters={[
          { key: "status", label: "Статус", options: options(bookingStatusLabel) },
          { key: "period", label: "Период", options: [
            { value: "now", label: "Сейчас проживают" },
            { value: "future", label: "Предстоящие" },
            { value: "past", label: "Прошедшие" },
          ] },
        ]}
        defaultSort={{ key: "checkin", dir: "desc" }}
        searchPlaceholder="Объект, клиент, телефон…"
        emptyTitle="Бронирований пока нет"
        emptyText="Оформите бронь из заявки или кнопкой «+ Бронирование»."
      />
    </>
  );
}
