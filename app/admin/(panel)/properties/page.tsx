import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Row } from "@/components/admin/DataTable";
import { options, propertyStatusLabel, propertyStatusTone } from "@/lib/admin-ui";
import { formatMoney, priceUnitLabel, propertyKindLabel, regionLabel, todayIso } from "@/lib/labels";
import type { Property } from "@/lib/types";

export const metadata: Metadata = { title: "Объекты" };

export default async function PropertiesPage() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data, error }, { data: busy }] = await Promise.all([
    supabase.from("properties").select("*").order("sort_order").returns<Property[]>(),
    supabase.from("bookings").select("property_id").neq("status", "cancelled").lte("check_in", today).gt("check_out", today),
  ]);
  const occupied = new Set((busy ?? []).map((b) => b.property_id));

  const rows: Row[] = (data ?? []).map((p) => ({
    id: p.id,
    href: `/admin/properties/${p.id}`,
    search: [p.title, p.location, p.description, p.features.join(" ")].join(" "),
    filters: { kind: p.kind, region: p.region, status: p.status },
    sort: { title: p.title, region: p.region, price: Number(p.price), status: p.status, order: p.sort_order },
    cells: {
      title: { text: p.title, sub: `${propertyKindLabel[p.kind]} · ${p.capacity ?? ""}` },
      region: { text: regionLabel[p.region], sub: p.location },
      price: { text: `${formatMoney(p.price)} / ${priceUnitLabel[p.price_unit]}` },
      now: occupied.has(p.id) ? { text: "Занят сегодня", badge: "tone-amber" } : { text: "Свободен", badge: "tone-green" },
      status: { text: propertyStatusLabel[p.status], badge: propertyStatusTone[p.status] },
    },
  }));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Объекты</h1>
          <p>Каталог жилья и помещений. Активные объекты видны на сайте и AI-помощнику.</p>
        </div>
        <Link className="a-btn a-btn-primary" href="/admin/properties/new">
          + Объект
        </Link>
      </div>
      {error && <div className="a-alert err">Не удалось загрузить объекты: {error.message}</div>}
      <DataTable
        rows={rows}
        columns={[
          { key: "title", label: "Объект" },
          { key: "region", label: "Регион" },
          { key: "price", label: "Цена", num: true },
          { key: "now", label: "Сейчас", sortable: false },
          { key: "status", label: "Статус" },
        ]}
        filters={[
          { key: "region", label: "Регион", options: options(regionLabel) },
          { key: "kind", label: "Тип", options: options(propertyKindLabel) },
          { key: "status", label: "Статус", options: options(propertyStatusLabel) },
        ]}
        defaultSort={{ key: "order", dir: "asc" }}
        searchPlaceholder="Название, место, удобства…"
        emptyTitle="Объектов пока нет"
      />
    </>
  );
}
