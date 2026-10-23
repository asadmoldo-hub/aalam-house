import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HBars, StackedBars } from "@/components/admin/Charts";
import { formatMoney, leadSourceLabel, leadStatusLabel, todayIso } from "@/lib/labels";
import { daysAgoIso, lastMonths, pct } from "@/lib/stats";
import type { LeadSource, LeadStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Аналитика" };

const periods = [
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
  { days: 365, label: "Год" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = periods.some((p) => String(p.days) === sp.days) ? Number(sp.days) : 30;
  const supabase = await createClient();
  const since = daysAgoIso(days);
  const today = todayIso();
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const yearAgo = lastMonths(12)[0].key + "-01";

  const [leads, bookingsYear, properties, sessions, upcoming] = await Promise.all([
    supabase.from("leads").select("source, status, property_id, created_at").gte("created_at", since),
    supabase.from("bookings").select("check_in, total_price, status, property_id").neq("status", "cancelled").gte("check_in", yearAgo),
    supabase.from("properties").select("id, title").eq("status", "active"),
    supabase.from("chat_sessions").select("lead_id, message_count, input_tokens, output_tokens").gte("created_at", since),
    supabase.from("bookings").select("property_id, check_in, check_out").neq("status", "cancelled").lt("check_in", horizon).gt("check_out", today),
  ]);

  const L = leads.data ?? [];
  const total = L.length;
  const converted = L.filter((l) => l.status === "converted").length;
  const lost = L.filter((l) => l.status === "lost").length;
  const S = sessions.data ?? [];
  const chatWithLead = S.filter((s) => s.lead_id).length;
  const tokensIn = S.reduce((a, s) => a + (s.input_tokens ?? 0), 0);
  const tokensOut = S.reduce((a, s) => a + (s.output_tokens ?? 0), 0);
  const titles = new Map((properties.data ?? []).map((p) => [p.id, p.title]));

  const bySource = Object.entries(leadSourceLabel)
    .map(([k, label]) => ({ label, value: L.filter((l) => l.source === (k as LeadSource)).length }))
    .filter((r) => r.value > 0);
  const byStatus = (Object.keys(leadStatusLabel) as LeadStatus[]).map((k) => ({
    label: leadStatusLabel[k],
    value: L.filter((l) => l.status === k).length,
  }));

  const months = lastMonths(12);
  const revenue = new Map(months.map((m) => [m.key, 0]));
  const revenueByProperty = new Map<string, number>();
  for (const b of bookingsYear.data ?? []) {
    const key = b.check_in.slice(0, 7);
    if (revenue.has(key)) revenue.set(key, revenue.get(key)! + Number(b.total_price ?? 0));
    revenueByProperty.set(b.property_id, (revenueByProperty.get(b.property_id) ?? 0) + Number(b.total_price ?? 0));
  }
  const yearRevenue = [...revenue.values()].reduce((a, b) => a + b, 0);

  const leadsByProperty = new Map<string, number>();
  for (const l of L) if (l.property_id) leadsByProperty.set(l.property_id, (leadsByProperty.get(l.property_id) ?? 0) + 1);

  // Загрузка на 30 дней вперёд: занятые ночи / 30
  const busyNights = new Map<string, number>();
  for (const b of upcoming.data ?? []) {
    const from = Math.max(Date.parse(b.check_in), Date.parse(today));
    const to = Math.min(Date.parse(b.check_out), Date.parse(horizon));
    const n = Math.max(0, Math.round((to - from) / 86_400_000));
    busyNights.set(b.property_id, (busyNights.get(b.property_id) ?? 0) + n);
  }
  const occupancy = [...titles.entries()]
    .map(([id, label]) => ({ label, value: Math.min(100, pct(busyNights.get(id) ?? 0, 30)) }))
    .sort((a, b) => b.value - a.value);

  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([id, value]) => ({ label: titles.get(id) ?? "Архивный объект", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Аналитика</h1>
          <p>Все показатели считаются по реальным данным CRM</p>
        </div>
        <div className="a-actions" role="group" aria-label="Период">
          {periods.map((p) => (
            <Link key={p.days} href={`/admin/analytics?days=${p.days}`} className={p.days === days ? "a-btn a-btn-primary a-btn-sm" : "a-btn a-btn-sm"}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="a-grid a-kpis">
        <Kpi label="Заявок за период" value={total} sub={`отказов: ${lost}`} />
        <Kpi label="Конверсия в бронь" value={`${pct(converted, total)}%`} sub={`${converted} из ${total} заявок`} />
        <Kpi label="Диалогов в AI-чате" value={S.length} sub={`с заявкой: ${chatWithLead} (${pct(chatWithLead, S.length)}%)`} />
        <Kpi label="Выручка за 12 мес." value={formatMoney(yearRevenue)} sub="брони без отменённых" />
        <Kpi
          label="Токены OpenAI за период"
          value={new Intl.NumberFormat("ru-RU").format(tokensIn + tokensOut)}
          sub={`вход ${new Intl.NumberFormat("ru-RU").format(tokensIn)} · выход ${new Intl.NumberFormat("ru-RU").format(tokensOut)}`}
        />
      </div>

      <div className="a-grid a-2eq">
        <section className="a-card">
          <div className="a-card-head">
            <h2>Источники заявок</h2>
          </div>
          <HBars rows={bySource} />
        </section>
        <section className="a-card">
          <div className="a-card-head">
            <h2>Воронка по статусам</h2>
            <p>текущий статус заявок за период</p>
          </div>
          {total ? <HBars rows={byStatus} format={(v) => `${v} · ${pct(v, total)}%`} /> : <div className="a-empty">Нет заявок за период</div>}
        </section>
      </div>

      <section className="a-card a-mt">
        <div className="a-card-head">
          <h2>Выручка по месяцам заезда</h2>
          <p>сом, 12 месяцев</p>
        </div>
        {yearRevenue ? (
          <StackedBars
            data={months.map((m) => ({ label: m.label, values: { revenue: revenue.get(m.key)! } }))}
            series={[{ key: "revenue", label: "Выручка", color: "var(--series-1)" }]}
            unit=" сом"
          />
        ) : (
          <div className="a-empty">
            <b>Пока нет бронирований</b>
            График заполнится, когда появятся брони.
          </div>
        )}
      </section>

      <div className="a-grid a-2eq a-mt">
        <section className="a-card">
          <div className="a-card-head">
            <h2>Загрузка объектов</h2>
            <p>следующие 30 дней</p>
          </div>
          <HBars rows={occupancy} format={(v) => `${v}%`} />
        </section>
        <section className="a-card">
          <div className="a-card-head">
            <h2>Объекты по выручке</h2>
            <p>12 месяцев</p>
          </div>
          <HBars rows={top(revenueByProperty)} format={formatMoney} />
          <div className="a-card-head" style={{ borderTop: "1px solid var(--a-border)" }}>
            <h2>Объекты по заявкам</h2>
            <p>за период</p>
          </div>
          <HBars rows={top(leadsByProperty)} />
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="a-card a-kpi">
      <div className="a-kpi-label">{label}</div>
      <div className="a-kpi-value">{value}</div>
      <div className="a-kpi-sub">{sub}</div>
    </div>
  );
}
