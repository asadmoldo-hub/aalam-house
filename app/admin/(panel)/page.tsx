import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StackedBars } from "@/components/admin/Charts";
import { leadSourceTone, leadStatusTone } from "@/lib/admin-ui";
import { bookingStatusLabel, formatDateTime, formatMoney, leadSourceLabel, leadStatusLabel, todayIso } from "@/lib/labels";
import { daysAgoIso, delta, lastDays, toDayKey } from "@/lib/stats";
import type { Lead, LeadSource } from "@/lib/types";

export const metadata: Metadata = { title: "Дашборд" };

const activityText: Record<string, (d: Record<string, string>) => string> = {
  "lead:created": (d) => `Новая заявка: ${d.name} (${leadSourceLabel[d.source as LeadSource] ?? d.source})`,
  "lead:status_changed": (d) =>
    `Заявка ${d.name}: ${leadStatusLabel[d.from as Lead["status"]] ?? d.from} → ${leadStatusLabel[d.to as Lead["status"]] ?? d.to}`,
  "booking:created": (d) => `Новое бронирование на ${d.check_in} – ${d.check_out}`,
  "booking:status_changed": (d) =>
    `Бронь: ${bookingStatusLabel[d.from as keyof typeof bookingStatusLabel] ?? d.from} → ${bookingStatusLabel[d.to as keyof typeof bookingStatusLabel] ?? d.to}`,
};

export default async function Dashboard() {
  const supabase = await createClient();
  const today = todayIso();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [leads30, leadsPrev, newLeads, clients, properties, upcoming, monthBookings, activities, recentLeads] = await Promise.all([
    supabase.from("leads").select("created_at, source").gte("created_at", daysAgoIso(30)),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", daysAgoIso(14)).lt("created_at", daysAgoIso(7)),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed", "checked_in"]).gte("check_out", today),
    supabase.from("bookings").select("total_price").neq("status", "cancelled").gte("check_in", monthStart),
    supabase.from("activities").select("id, entity, entity_id, action, details, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("leads").select("id, name, phone, source, status, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const leadRows = leads30.data ?? [];
  const weekAgo = daysAgoIso(7);
  const leadsWeek = leadRows.filter((l) => l.created_at >= weekAgo).length;
  const chatWeek = leadRows.filter((l) => l.created_at >= weekAgo && l.source === "ai_chat").length;
  const monthRevenue = (monthBookings.data ?? []).reduce((s, b) => s + Number(b.total_price ?? 0), 0);

  const days = lastDays(30);
  const byDay = new Map(days.map((d) => [d.key, { website_form: 0, ai_chat: 0, other: 0 }]));
  for (const l of leadRows) {
    const bucket = byDay.get(toDayKey(l.created_at));
    if (!bucket) continue;
    if (l.source === "website_form") bucket.website_form++;
    else if (l.source === "ai_chat") bucket.ai_chat++;
    else bucket.other++;
  }

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Дашборд</h1>
          <p>Сводка по заявкам, клиентам и бронированиям</p>
        </div>
        <div className="a-actions">
          <Link className="a-btn" href="/admin/leads?status=new">
            Новые заявки
          </Link>
          <Link className="a-btn a-btn-primary" href="/admin/bookings/new">
            + Бронирование
          </Link>
        </div>
      </div>

      <div className="a-grid a-kpis">
        <Kpi label="Новые заявки" value={newLeads.count ?? 0} sub="ждут обработки" href="/admin/leads?status=new" />
        <Kpi label="Заявок за 7 дней" value={leadsWeek} sub={`${delta(leadsWeek, leadsPrev.count ?? 0)} · из чата: ${chatWeek}`} />
        <Kpi label="Активные брони" value={upcoming.count ?? 0} sub="текущие и предстоящие" href="/admin/bookings" />
        <Kpi label="Выручка месяца" value={formatMoney(monthRevenue)} sub="по броням с заездом в этом месяце" />
        <Kpi label="Клиенты" value={clients.count ?? 0} sub={`объектов в каталоге: ${properties.count ?? 0}`} href="/admin/clients" />
      </div>

      <div className="a-grid a-2col">
        <section className="a-card">
          <div className="a-card-head">
            <h2>Заявки за 30 дней</h2>
            <p>по источникам</p>
          </div>
          {leadRows.length === 0 ? (
            <div className="a-empty">
              <b>Заявок пока нет</b>
              Они появятся здесь после отправки формы на сайте или через AI-чат.
            </div>
          ) : (
            <StackedBars
              data={days.map((d) => ({ label: d.label, values: byDay.get(d.key)! }))}
              series={[
                { key: "website_form", label: "Форма сайта", color: "var(--series-1)" },
                { key: "ai_chat", label: "AI-чат", color: "var(--series-2)" },
                { key: "other", label: "Звонки и вручную", color: "var(--series-3)" },
              ]}
            />
          )}
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <h2>Быстрые действия</h2>
          </div>
          <div className="a-quick">
            <Link className="a-btn" href="/admin/leads/new">+ Заявка по звонку</Link>
            <Link className="a-btn" href="/admin/clients/new">+ Клиент</Link>
            <Link className="a-btn" href="/admin/properties/new">+ Объект</Link>
            <Link className="a-btn" href="/admin/knowledge/new">+ В базу знаний</Link>
          </div>
          <div className="a-card-head" style={{ borderTop: "1px solid var(--a-border)" }}>
            <h2>Последние события</h2>
          </div>
          {activities.data?.length ? (
            <ul className="a-list a-feed">
              {activities.data.map((a) => {
                const fmt = activityText[`${a.entity}:${a.action}`];
                const href = a.entity === "lead" ? `/admin/leads/${a.entity_id}` : `/admin/bookings/${a.entity_id}`;
                return (
                  <li key={a.id}>
                    <span className="dot" aria-hidden />
                    <span style={{ flex: 1 }}>
                      <Link href={href}>{fmt ? fmt(a.details as Record<string, string>) : a.action}</Link>
                      <span className="a-muted" style={{ display: "block", fontSize: 12 }}>
                        {formatDateTime(a.created_at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="a-empty">Событий пока нет</div>
          )}
        </section>
      </div>

      <section className="a-card a-mt">
        <div className="a-card-head">
          <h2>Последние заявки</h2>
          <Link href="/admin/leads">Все заявки →</Link>
        </div>
        {recentLeads.data?.length ? (
          <ul className="a-list">
            {recentLeads.data.map((l) => (
              <li key={l.id}>
                <span>
                  <Link href={`/admin/leads/${l.id}`}>
                    <b>{l.name}</b>
                  </Link>{" "}
                  <span className="a-muted">{l.phone}</span>
                </span>
                <span className="a-row">
                  <span className={`a-badge ${leadSourceTone[l.source as LeadSource]}`}>{leadSourceLabel[l.source as LeadSource]}</span>
                  <span className={`a-badge ${leadStatusTone[l.status as Lead["status"]]}`}>{leadStatusLabel[l.status as Lead["status"]]}</span>
                  <span className="meta">{formatDateTime(l.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="a-empty">Заявок пока нет</div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value, sub, href }: { label: string; value: string | number; sub: string; href?: string }) {
  const body = (
    <>
      <div className="a-kpi-label">{label}</div>
      <div className="a-kpi-value">{value}</div>
      <div className="a-kpi-sub">{sub}</div>
    </>
  );
  return href ? (
    <Link href={href} className="a-card a-kpi" style={{ color: "inherit" }}>
      {body}
    </Link>
  ) : (
    <div className="a-card a-kpi">{body}</div>
  );
}
