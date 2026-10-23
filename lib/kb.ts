import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfig, openai } from "@/lib/openai";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

// Режет текст по абзацам, длинные абзацы — по предложениям, с перекрытием
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const pieces = clean
    .split(/\n{2,}/)
    .flatMap((p) => (p.length > CHUNK_SIZE ? p.match(/[^.!?\n]+[.!?]*\s*/g) ?? [p] : [p]));

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if ((current + "\n" + piece).length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + "\n" + piece;
    } else {
      current = current ? current + "\n" + piece : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const toPgVector = (v: number[]) => `[${v.join(",")}]`;

async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  // Пачки по 96 фрагментов — укладываемся в лимиты запроса
  for (let i = 0; i < texts.length; i += 96) {
    const res = await openai().embeddings.create({ model: aiConfig.embeddingModel, input: texts.slice(i, i + 96) });
    for (const d of res.data.sort((a, b) => a.index - b.index)) {
      if (d.embedding.length !== aiConfig.embeddingDimensions) {
        throw new Error(`Размерность эмбеддинга ${d.embedding.length}, а в базе vector(${aiConfig.embeddingDimensions})`);
      }
      out.push(d.embedding);
    }
  }
  return out;
}

// Пересобирает фрагменты документа. Эмбеддинги неизменившихся фрагментов переиспользуются,
// новые считаются через OpenAI. Если OpenAI недоступен, фрагменты сохраняются без векторов
// и находятся полнотекстовым поиском.
export async function indexDocument(documentId: string) {
  const db = createAdminClient();
  const { data: doc, error } = await db.from("kb_documents").select("id, title, content").eq("id", documentId).single();
  if (error || !doc) throw new Error(error?.message ?? "Документ не найден");

  const chunks = chunkText(doc.content).map((c) => `${doc.title}\n${c}`);

  const { data: old } = await db
    .from("kb_chunks")
    .select("content, embedding")
    .eq("document_id", documentId)
    .not("embedding", "is", null);
  const reuse = new Map<string, string>((old ?? []).map((c) => [c.content as string, c.embedding as string]));

  const missing = [...new Set(chunks.filter((c) => !reuse.has(c)))];
  let embedError: string | null = null;
  if (missing.length) {
    try {
      const vectors = await embedTexts(missing);
      missing.forEach((c, i) => reuse.set(c, toPgVector(vectors[i])));
    } catch (e) {
      embedError = e instanceof Error ? e.message : String(e);
      console.error("[kb] embeddings unavailable:", embedError);
    }
  }

  await db.from("kb_chunks").delete().eq("document_id", documentId);
  if (chunks.length) {
    const { error: insErr } = await db.from("kb_chunks").insert(
      chunks.map((content, i) => ({ document_id: documentId, chunk_index: i, content, embedding: reuse.get(content) ?? null })),
    );
    if (insErr) throw new Error(insErr.message);
  }

  const embedded = chunks.filter((c) => reuse.has(c)).length;
  await db
    .from("kb_documents")
    .update({ indexed_at: new Date().toISOString(), total_chunks: chunks.length, embedded_chunks: embedded })
    .eq("id", documentId);

  return { chunks: chunks.length, embedded, newlyEmbedded: embedError ? 0 : missing.length, embedError };
}

// Небольшой кэш эмбеддингов запросов в памяти инстанса: одинаковые вопросы не оплачиваются повторно
const queryCache = new Map<string, string>();

async function queryVector(query: string) {
  const key = query.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  const [v] = await embedTexts([query]);
  const vec = toPgVector(v);
  if (queryCache.size > 500) queryCache.delete(queryCache.keys().next().value!);
  queryCache.set(key, vec);
  return vec;
}

export type KbHit = { title: string; kind: string; content: string; score: number };

export async function searchKnowledge(query: string, limit = 5): Promise<{ hits: KbHit[]; mode: "hybrid" | "fulltext" }> {
  let queryEmbedding: string | null = null;
  try {
    queryEmbedding = await queryVector(query);
  } catch (e) {
    console.error("[kb] query embedding failed, fulltext only:", e instanceof Error ? e.message : e);
  }

  const { data, error } = await createAdminClient().rpc("search_kb", {
    query_text: query,
    query_embedding: queryEmbedding,
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return {
    hits: (data ?? []).map((r: KbHit) => ({ title: r.title, kind: r.kind, content: r.content, score: r.score })),
    mode: queryEmbedding ? "hybrid" : "fulltext",
  };
}
