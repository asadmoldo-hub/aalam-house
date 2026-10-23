import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Row } from "@/components/admin/DataTable";
import { SubmitButton } from "@/components/admin/ActionForm";
import { reindexAll } from "@/app/admin/actions/content";
import { searchKnowledge, type KbHit } from "@/lib/kb";
import { options } from "@/lib/admin-ui";
import { formatDateTime, kbKindLabel } from "@/lib/labels";
import type { KbDocument } from "@/lib/types";

export const metadata: Metadata = { title: "База знаний" };

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .select("id, title, kind, is_published, indexed_at, total_chunks, embedded_chunks, updated_at, source_filename")
    .order("updated_at", { ascending: false })
    .returns<KbDocument[]>();

  const docs = data ?? [];
  const chunks = docs.reduce((s, d) => s + d.total_chunks, 0);
  const embedded = docs.reduce((s, d) => s + d.embedded_chunks, 0);

  let search: { hits: KbHit[]; mode: string } | null = null;
  let searchError: string | null = null;
  if (q && q.trim().length >= 2) {
    try {
      search = await searchKnowledge(q.trim().slice(0, 300), 5);
    } catch (e) {
      searchError = e instanceof Error ? e.message : String(e);
    }
  }

  const rows: Row[] = docs.map((d) => {
    const stale = !d.indexed_at || d.indexed_at < d.updated_at;
    const index = !d.total_chunks
      ? { text: "Не проиндексирован", badge: "tone-red" }
      : d.embedded_chunks === d.total_chunks
        ? { text: `Векторный · ${d.total_chunks} фр.`, badge: "tone-green" }
        : { text: `Полнотекстовый · ${d.total_chunks} фр.`, badge: "tone-amber" };
    return {
      id: d.id,
      href: `/admin/knowledge/${d.id}`,
      search: `${d.title} ${d.source_filename ?? ""}`,
      filters: { kind: d.kind, published: d.is_published ? "yes" : "no" },
      sort: { title: d.title, kind: d.kind, updated: d.updated_at },
      cells: {
        title: { text: d.title, sub: d.source_filename ?? undefined },
        kind: { text: kbKindLabel[d.kind], badge: "tone-gray plain" },
        published: d.is_published ? { text: "Да", badge: "tone-green" } : { text: "Скрыт", badge: "tone-gray" },
        index: stale ? { text: "Нужна переиндексация", badge: "tone-red" } : index,
        updated: { text: formatDateTime(d.updated_at) },
      },
    };
  });

  return (
    <>
      <div className="a-head">
        <div>
          <h1>База знаний</h1>
          <p>
            Источник ответов AI-помощника · {docs.length} материалов · {chunks} фрагментов · с эмбеддингами: {embedded}
          </p>
        </div>
        <div className="a-actions">
          <form action={reindexAll}>
            <SubmitButton label="Переиндексировать всё" className="a-btn" />
          </form>
          <Link className="a-btn a-btn-primary" href="/admin/knowledge/new">
            + Материал
          </Link>
        </div>
      </div>

      {chunks > 0 && embedded < chunks && (
        <div className="a-alert warn" style={{ marginBottom: 16 }}>
          Часть фрагментов без эмбеддингов — для них работает полнотекстовый поиск. Нажмите «Переиндексировать всё»:
          эмбеддинги создаст OpenAI (text-embedding-3-small).
        </div>
      )}

      <section className="a-card a-card-pad" style={{ marginBottom: 16 }}>
        <form className="a-row" action="/admin/knowledge">
          <input className="a-input" name="q" defaultValue={q} placeholder="Проверить поиск: например, «можно ли с собакой»" style={{ maxWidth: 480 }} />
          <button className="a-btn" type="submit">
            Найти
          </button>
        </form>
        {searchError && <div className="a-alert err a-mt">Ошибка поиска: {searchError}</div>}
        {search && (
          <div className="a-mt">
            <p className="a-muted" style={{ marginBottom: 8 }}>
              Режим: {search.mode === "hybrid" ? "гибридный (вектор + полнотекст)" : "полнотекстовый"} · найдено {search.hits.length}. Эти
              фрагменты получит AI-помощник.
            </p>
            {search.hits.length ? (
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                {search.hits.map((h, i) => (
                  <li key={i}>
                    <b>{h.title}</b> <span className="a-muted">· score {h.score.toFixed(4)}</span>
                    <div className="a-pre a-muted">{h.content.slice(0, 320)}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="a-alert warn">Ничего не найдено — помощник ответит, что подтверждённой информации нет.</div>
            )}
          </div>
        )}
      </section>

      {error && <div className="a-alert err">Не удалось загрузить базу знаний: {error.message}</div>}
      <DataTable
        rows={rows}
        columns={[
          { key: "title", label: "Материал" },
          { key: "kind", label: "Тип" },
          { key: "published", label: "Доступен", sortable: false },
          { key: "index", label: "Индекс", sortable: false },
          { key: "updated", label: "Изменён" },
        ]}
        filters={[
          { key: "kind", label: "Тип", options: options(kbKindLabel) },
          { key: "published", label: "Доступность", options: [{ value: "yes", label: "Доступные" }, { value: "no", label: "Скрытые" }] },
        ]}
        defaultSort={{ key: "updated", dir: "desc" }}
        searchPlaceholder="Заголовок или имя файла…"
        emptyTitle="База знаний пуста"
        emptyText="Добавьте информацию о компании, условия и ответы на частые вопросы."
      />
    </>
  );
}
