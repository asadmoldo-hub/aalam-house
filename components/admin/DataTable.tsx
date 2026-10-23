"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type Cell = { text: string; sub?: string; badge?: string; num?: boolean };
export type Row = {
  id: string;
  href?: string;
  cells: Record<string, Cell>;
  sort: Record<string, string | number>;
  filters?: Record<string, string>;
  search: string;
};
export type Column = { key: string; label: string; sortable?: boolean; num?: boolean };
export type Filter = { key: string; label: string; options: { value: string; label: string }[] };

// Таблица с поиском, фильтрами и сортировкой. Ячейки готовит сервер (только сериализуемые данные).
export function DataTable({
  rows,
  columns,
  filters = [],
  defaultSort,
  searchPlaceholder = "Поиск…",
  emptyTitle = "Пока пусто",
  emptyText,
  initialFilters = {},
}: {
  rows: Row[];
  columns: Column[];
  filters?: Filter[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyText?: string;
  initialFilters?: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>(initialFilters);
  const [sort, setSort] = useState(defaultSort ?? { key: columns[0].key, dir: "asc" as const });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!needle || r.search.toLowerCase().includes(needle)) &&
        Object.entries(active).every(([k, v]) => !v || r.filters?.[k] === v),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const x = a.sort[sort.key] ?? "";
      const y = b.sort[sort.key] ?? "";
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), "ru") * dir;
    });
  }, [rows, q, active, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="a-card">
      <div className="a-toolbar">
        <input
          className="a-input"
          type="search"
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Поиск"
        />
        {filters.map((f) => (
          <select
            key={f.key}
            className="a-select"
            value={active[f.key] ?? ""}
            onChange={(e) => setActive({ ...active, [f.key]: e.target.value })}
            aria-label={f.label}
          >
            <option value="">{f.label}: все</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="a-empty">
          <b>{rows.length === 0 ? emptyTitle : "Ничего не найдено"}</b>
          {rows.length === 0 ? emptyText : "Измените запрос или фильтры."}
        </div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table stack">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.num ? "num" : undefined} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortable === false ? (
                      c.label
                    ) : (
                      <button onClick={() => toggleSort(c.key)}>
                        {c.label}
                        <span aria-hidden>{sort.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={r.href ? "link" : undefined}
                  onClick={r.href ? () => router.push(r.href!) : undefined}
                  onKeyDown={r.href ? (e) => e.key === "Enter" && router.push(r.href!) : undefined}
                  tabIndex={r.href ? 0 : undefined}
                >
                  {columns.map((c) => {
                    const cell = r.cells[c.key];
                    return (
                      <td key={c.key} data-label={c.label} className={c.num ? "num" : undefined}>
                        {cell?.badge ? <span className={`a-badge ${cell.badge}`}>{cell.text}</span> : cell?.text}
                        {cell?.sub && <span className="sub">{cell.sub}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="a-table-foot">
        Показано {visible.length} из {rows.length}
      </div>
    </div>
  );
}
