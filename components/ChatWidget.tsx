"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; lead?: boolean; error?: boolean };

const toolLabels: Record<string, string> = {
  list_properties: "Смотрю каталог объектов",
  check_availability: "Проверяю свободные даты",
  search_knowledge: "Ищу в базе знаний",
  get_services: "Смотрю услуги",
  get_business_info: "Уточняю контакты",
  create_lead: "Оформляю заявку",
};

const suggestions = ["Коттедж на Иссык-Куле на 6 человек", "Какой нужен залог?", "Үй-бүлө менен эс алууга эмне сунуштайсыз?"];

const STORE_KEY = "aalam-chat";

function loadState(): { sessionId: string; messages: Msg[] } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessionId: crypto.randomUUID(), messages: [] };
}

function saveState(state: { sessionId: string; messages: Msg[] }) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {}
}

const errorText: Record<string, string> = {
  rate_limited: "Слишком много сообщений. Подождите несколько минут.",
  message_too_long: "Сообщение слишком длинное — сократите его, пожалуйста.",
  chat_disabled: "Чат временно отключён. Позвоните нам или оставьте заявку через форму.",
};

export function ChatWidget({ greeting }: { greeting: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ sessionId: string; messages: Msg[] } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setState(loadState()), []);
  useEffect(() => {
    if (state) saveState(state);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [state]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const messages = state?.messages ?? [];

  function patchLast(fn: (m: Msg) => Msg) {
    setState((s) => (s ? { ...s, messages: [...s.messages.slice(0, -1), fn(s.messages[s.messages.length - 1])] } : s));
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || !state) return;
    const history = [...state.messages.filter((m) => !m.error), { role: "user" as const, content: t }];
    setState({ ...state, messages: [...state.messages, { role: "user", content: t }, { role: "assistant", content: "", tools: [] }] });
    setInput("");
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const code = (await res.json().catch(() => ({}))).error as string | undefined;
        patchLast(() => ({
          role: "assistant",
          content: errorText[code ?? ""] ?? "Помощник временно недоступен. Позвоните нам или оставьте заявку через форму.",
          error: true,
        }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") patchLast((m) => ({ ...m, content: m.content + ev.delta }));
          else if (ev.type === "tool") patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), ev.name] }));
          else if (ev.type === "lead_created") patchLast((m) => ({ ...m, lead: true }));
          else if (ev.type === "error") patchLast((m) => ({ ...m, content: m.content || ev.message, error: !m.content }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        patchLast(() => ({ role: "assistant", content: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.", error: true }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setState({ sessionId: crypto.randomUUID(), messages: [] });
  }

  return (
    <>
      <button
        className={open ? "chat-fab open" : "chat-fab"}
        aria-label={open ? "Закрыть чат" : "Открыть чат с помощником"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path fill="currentColor" d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path
              fill="currentColor"
              d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
            />
          </svg>
        )}
      </button>

      {open && (
        <section className="chat-panel" role="dialog" aria-label="Чат с помощником Аалам Хаус">
          <header className="chat-head">
            <div>
              <b>Помощник Аалам Хаус</b>
              <span>AI · отвечает по данным компании</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {messages.length > 0 && (
                <button onClick={reset} aria-label="Начать новый диалог" title="Новый диалог">
                  ↺
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Свернуть чат">
                ✕
              </button>
            </div>
          </header>

          <div className="chat-list" ref={listRef} aria-live="polite">
            <div className="msg bot">{greeting}</div>
            {messages.length === 0 && (
              <div className="chat-suggest">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") return <div key={i} className="msg user">{m.content}</div>;
              return (
                <div key={i} className={m.error ? "msg error" : "msg bot"} role={m.error ? "alert" : undefined}>
                  {busy && isLast && !m.content && (
                    <span className="tool-run">{m.tools?.length ? `${toolLabels[m.tools[m.tools.length - 1]] ?? "Работаю"}…` : "Думает…"}</span>
                  )}
                  {m.content && <span>{m.content}</span>}
                  {m.lead && <span className="tool-done">✓ Заявка отправлена менеджеру</span>}
                </div>
              );
            })}
          </div>

          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              maxLength={2000}
              placeholder="Напишите вопрос…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button type="submit" disabled={busy || !input.trim() || !state} aria-label="Отправить">
              {busy ? (
                <span className="chat-spin" aria-hidden />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path fill="currentColor" d="M3 20.5V14l9-2-9-2V3.5L22 12z" />
                </svg>
              )}
            </button>
          </form>
          <p className="chat-note">AI может ошибаться. Цены и даты подтверждает менеджер.</p>
        </section>
      )}
    </>
  );
}
