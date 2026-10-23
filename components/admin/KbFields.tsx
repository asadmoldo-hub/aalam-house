import { kbKindLabel } from "@/lib/labels";
import type { KbDocument } from "@/lib/types";

export function KbFields({ d }: { d?: Partial<KbDocument> }) {
  return (
    <>
      <div className="a-form-grid">
        <label className="a-field">
          <span>Заголовок *</span>
          <input className="a-input" name="title" required maxLength={200} defaultValue={d?.title} placeholder="Например: Условия заселения" />
        </label>
        <label className="a-field">
          <span>Тип *</span>
          <select className="a-select" name="kind" defaultValue={d?.kind ?? "faq"}>
            {Object.entries(kbKindLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="a-field">
        <span>Текст</span>
        <textarea
          className="a-textarea"
          name="content"
          rows={14}
          defaultValue={d?.content ?? ""}
          placeholder={"Вопрос: Можно ли заселиться раньше?\nОтвет: Ранний заезд возможен по договорённости…"}
        />
        <small>Для вопросов-ответов используйте формат «Вопрос: … Ответ: …» — так поиск находит точнее</small>
      </label>
      <label className="a-field">
        <span>Файл (TXT, MD или PDF до 4 МБ)</span>
        <input className="a-input" type="file" name="file" accept=".txt,.md,.pdf,text/plain,application/pdf" style={{ paddingTop: 6 }} />
        <small>Текст файла добавится к полю «Текст»{d?.source_filename ? `. Сейчас: ${d.source_filename}` : ""}</small>
      </label>
      <label className="a-check">
        <input type="checkbox" name="is_published" defaultChecked={d?.is_published ?? true} />
        Доступно AI-помощнику
      </label>
    </>
  );
}
