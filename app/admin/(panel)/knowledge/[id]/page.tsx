import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, ConfirmButton } from "@/components/admin/ActionForm";
import { KbFields } from "@/components/admin/KbFields";
import { deleteKbDocument, updateKbDocument } from "@/app/admin/actions/content";
import { formatDateTime } from "@/lib/labels";
import type { KbDocument } from "@/lib/types";

export const metadata: Metadata = { title: "Материал базы знаний" };

export default async function KbDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("kb_documents").select("*").eq("id", id).maybeSingle<KbDocument>();
  if (!d) notFound();
  const [{ data: chunks }, { data: withVectors }] = await Promise.all([
    supabase.from("kb_chunks").select("chunk_index, content").eq("document_id", id).order("chunk_index").limit(50),
    supabase.from("kb_chunks").select("chunk_index").eq("document_id", id).not("embedding", "is", null),
  ]);
  const vectorized = new Set((withVectors ?? []).map((c) => c.chunk_index));

  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/knowledge">База знаний</Link> / {d.title}
          </div>
          <h1>{d.title}</h1>
          <p>
            Проиндексирован: {formatDateTime(d.indexed_at)} · фрагментов {d.total_chunks}, с эмбеддингами {d.embedded_chunks}
          </p>
        </div>
      </div>
      <div className="a-grid a-2col">
        <section className="a-card a-card-pad">
          <ActionForm action={updateKbDocument.bind(null, d.id)} submitLabel="Сохранить и переиндексировать">
            <KbFields d={d} />
          </ActionForm>
          <div className="a-mt">
            <ConfirmButton
              action={deleteKbDocument.bind(null, d.id)}
              label="Удалить материал"
              confirmText="Удалить материал? AI-помощник перестанет его использовать."
              className="a-btn a-btn-danger a-btn-sm"
            />
          </div>
        </section>
        <section className="a-card" style={{ alignSelf: "start" }}>
          <div className="a-card-head">
            <h2>Фрагменты индекса</h2>
            <p>то, что находит поиск</p>
          </div>
          {chunks?.length ? (
            <ul className="a-list">
              {chunks.map((c) => (
                <li key={c.chunk_index} style={{ display: "block" }}>
                  <div className="a-row" style={{ marginBottom: 4 }}>
                    <b>#{c.chunk_index + 1}</b>
                    <span className={`a-badge ${vectorized.has(c.chunk_index) ? "tone-green" : "tone-amber"}`}>{vectorized.has(c.chunk_index) ? "вектор" : "только текст"}</span>
                  </div>
                  <div className="a-pre a-muted">{c.content.slice(0, 400)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="a-empty">Фрагментов нет — сохраните материал, чтобы проиндексировать</div>
          )}
        </section>
      </div>
    </>
  );
}
