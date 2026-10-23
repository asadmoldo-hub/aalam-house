import "server-only";
import OpenAI from "openai";

// Единственная точка доступа к OpenAI. Ключ читается только на сервере.
let client: OpenAI | null = null;

export function openai() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY не задан");
  client ??= new OpenAI({ apiKey, maxRetries: 1, timeout: 45_000 });
  return client;
}

export const aiConfig = {
  get chatModel() {
    return process.env.OPENAI_MODEL || "gpt-6-luna";
  },
  get embeddingModel() {
    return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  },
  // text-embedding-3-small → 1536, совпадает с vector(1536) в kb_chunks
  embeddingDimensions: 1536,
  get configured() {
    return !!process.env.OPENAI_API_KEY;
  },
};
