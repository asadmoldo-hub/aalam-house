import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Row } from "@/components/admin/DataTable";
import { leadSourceTone, leadStatusTone, options } from "@/lib/admin-ui";
import { formatDateTime, leadSourceLabel, leadStatusLabel } from "@/lib/labels";
import type { Lead } from "@/lib/types";

export const metadata: Metadata = { title: "Заявки" };

type LeadRow = Lead & { properties: { title: string } | null; profiles: { full_name: string } | null };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; source?: string }> }) {
  const { status, source } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, properties(title), profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<LeadRow[]>();

  const rows: Row[] = (data ?? []).map((l) => ({
    id: l.id,
    href: `/admin/leads/${l.id}`,
    search: [l.name, l.phone, l.email, l.topic, l.message, l.properties?.title].filter(Boolean).join(" "),
    filters: { status: l.status, source: l.source },
    sort: { name: l.name, created: l.created_at, status: l.status, source: l.source },
    cells: {
      name: { text: l.name, sub: l.phone },
      topic: { text: l.properties?.title ?? l.topic ?? "—", sub: l.message?.slice(0, 80) },
      source: { text: leadSourceLabel[l.source], badge: leadSourceTone[l.source] },
      status: { text: leadStatusLabel[l.status], badge: leadStatusTone[l.status] },
      assigned: { text: l.profiles?.full_name ?? "—" },
      created: { text: formatDateTime(l.created_at) },
    },
  }));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Заявки</h1>
          <p>Обращения с сайта, из AI-чата и по телефону</p>
        </div>
        <Link className="a-btn a-btn-primary" href="/admin/leads/new">
          + Заявка вручную
        </Link>
      </div>
      {error && <div className="a-alert err">Не удалось загрузить заявки: {error.message}</div>}
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Клиент" },
          { key: "topic", label: "Запрос", sortable: false },
          { key: "source", label: "Источник" },
          { key: "status", label: "Статус" },
          { key: "assigned", label: "Ответственный", sortable: false },
          { key: "created", label: "Создана" },
        ]}
        filters={[
          { key: "status", label: "Статус", options: options(leadStatusLabel) },
          { key: "source", label: "Источник", options: options(leadSourceLabel) },
        ]}
        initialFilters={{ ...(status ? { status } : {}), ...(source ? { source } : {}) }}
        defaultSort={{ key: "created", dir: "desc" }}
        searchPlaceholder="Имя, телефон, текст…"
        emptyTitle="Заявок пока нет"
        emptyText="Отправьте форму на сайте или напишите AI-помощнику — заявка появится здесь."
      />
    </>
  );
}
