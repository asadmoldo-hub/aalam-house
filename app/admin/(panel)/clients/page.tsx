import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Row } from "@/components/admin/DataTable";
import { options } from "@/lib/admin-ui";
import { clientKindLabel, clientSourceLabel, formatDate } from "@/lib/labels";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Клиенты" };

type ClientRow = Client & { leads: { count: number }[]; bookings: { count: number }[] };

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, leads(count), bookings(count)")
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<ClientRow[]>();

  const rows: Row[] = (data ?? []).map((c) => {
    const leads = c.leads[0]?.count ?? 0;
    const bookings = c.bookings[0]?.count ?? 0;
    return {
      id: c.id,
      href: `/admin/clients/${c.id}`,
      search: [c.full_name, c.phone, c.email, c.telegram, c.notes].filter(Boolean).join(" "),
      filters: { kind: c.kind, source: c.source },
      sort: { name: c.full_name, kind: c.kind, leads, bookings, created: c.created_at },
      cells: {
        name: { text: c.full_name, sub: [c.phone, c.email].filter(Boolean).join(" · ") },
        kind: { text: clientKindLabel[c.kind], badge: "tone-gray plain" },
        source: { text: clientSourceLabel[c.source] ?? c.source },
        leads: { text: String(leads) },
        bookings: { text: String(bookings) },
        created: { text: formatDate(c.created_at) },
      },
    };
  });

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Клиенты</h1>
          <p>Гости, арендаторы, владельцы объектов и компании</p>
        </div>
        <Link className="a-btn a-btn-primary" href="/admin/clients/new">
          + Клиент
        </Link>
      </div>
      {error && <div className="a-alert err">Не удалось загрузить клиентов: {error.message}</div>}
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Клиент" },
          { key: "kind", label: "Тип" },
          { key: "source", label: "Источник", sortable: false },
          { key: "leads", label: "Заявок", num: true },
          { key: "bookings", label: "Броней", num: true },
          { key: "created", label: "Добавлен" },
        ]}
        filters={[
          { key: "kind", label: "Тип", options: options(clientKindLabel) },
          { key: "source", label: "Источник", options: options(clientSourceLabel) },
        ]}
        defaultSort={{ key: "created", dir: "desc" }}
        searchPlaceholder="Имя, телефон, email…"
        emptyTitle="Клиентов пока нет"
        emptyText="Создайте клиента вручную или из заявки кнопкой «Создать клиента»."
      />
    </>
  );
}
