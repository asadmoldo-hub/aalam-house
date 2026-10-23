import { clientKindLabel, clientSourceLabel, propertyKindLabel, regionLabel } from "@/lib/labels";
import { propertyStatusLabel } from "@/lib/admin-ui";
import type { Client, Property } from "@/lib/types";

// Наборы полей форм — общие для создания и редактирования

export function ClientFields({ c }: { c?: Partial<Client> }) {
  return (
    <>
      <div className="a-form-grid">
        <label className="a-field">
          <span>Имя / компания *</span>
          <input className="a-input" name="full_name" required maxLength={120} defaultValue={c?.full_name} />
        </label>
        <label className="a-field">
          <span>Телефон</span>
          <input className="a-input" name="phone" placeholder="+996 555 123 456" defaultValue={c?.phone ?? ""} />
        </label>
        <label className="a-field">
          <span>Email</span>
          <input className="a-input" name="email" type="email" defaultValue={c?.email ?? ""} />
        </label>
        <label className="a-field">
          <span>Telegram</span>
          <input className="a-input" name="telegram" maxLength={64} placeholder="@username" defaultValue={c?.telegram ?? ""} />
        </label>
        <label className="a-field">
          <span>Тип клиента *</span>
          <select className="a-select" name="kind" defaultValue={c?.kind ?? "guest"}>
            {Object.entries(clientKindLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Откуда пришёл</span>
          <select className="a-select" name="source" defaultValue={c?.source ?? "manual"}>
            {Object.entries(clientSourceLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="a-field">
        <span>Заметки</span>
        <textarea className="a-textarea" name="notes" maxLength={5000} defaultValue={c?.notes ?? ""} placeholder="Предпочтения, договорённости, особенности" />
      </label>
    </>
  );
}

export function PropertyFields({ p, owners }: { p?: Partial<Property>; owners: { id: string; full_name: string }[] }) {
  return (
    <>
      <div className="a-form-grid">
        <label className="a-field">
          <span>Название *</span>
          <input className="a-input" name="title" required maxLength={160} defaultValue={p?.title} />
        </label>
        <label className="a-field">
          <span>Тип *</span>
          <select className="a-select" name="kind" defaultValue={p?.kind ?? "apartment"}>
            {Object.entries(propertyKindLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Регион *</span>
          <select className="a-select" name="region" defaultValue={p?.region ?? "issyk_kul_north"}>
            {Object.entries(regionLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Расположение *</span>
          <input className="a-input" name="location" required maxLength={200} placeholder="Чолпон-Ата, центр" defaultValue={p?.location} />
        </label>
        <label className="a-field">
          <span>Цена, сом *</span>
          <input className="a-input" name="price" required inputMode="decimal" defaultValue={p?.price ?? ""} />
        </label>
        <label className="a-field">
          <span>За *</span>
          <select className="a-select" name="price_unit" defaultValue={p?.price_unit ?? "night"}>
            <option value="night">сутки (посуточно)</option>
            <option value="month">месяц (долгосрочно)</option>
          </select>
        </label>
        <label className="a-field">
          <span>Вместимость (текст)</span>
          <input className="a-input" name="capacity" maxLength={120} placeholder="до 8 гостей · 3 спальни" defaultValue={p?.capacity ?? ""} />
        </label>
        <label className="a-field">
          <span>Макс. гостей</span>
          <input className="a-input" name="max_guests" inputMode="numeric" defaultValue={p?.max_guests ?? ""} />
        </label>
        <label className="a-field">
          <span>Статус</span>
          <select className="a-select" name="status" defaultValue={p?.status ?? "active"}>
            {Object.entries(propertyStatusLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Владелец</span>
          <select className="a-select" name="owner_id" defaultValue={p?.owner_id ?? ""}>
            <option value="">— не указан —</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Порядок на сайте</span>
          <input className="a-input" name="sort_order" inputMode="numeric" defaultValue={p?.sort_order ?? 0} />
        </label>
      </div>
      <label className="a-field">
        <span>Удобства</span>
        <input className="a-input" name="features" defaultValue={p?.features?.join(", ") ?? ""} placeholder="Свой пляж, Баня, Wi-Fi" />
        <small>Через запятую, до 12 штук</small>
      </label>
      <label className="a-field">
        <span>Описание</span>
        <textarea className="a-textarea" name="description" maxLength={5000} defaultValue={p?.description ?? ""} />
        <small>Описание видит AI-помощник при подборе жилья</small>
      </label>
      <label className="a-check">
        <input type="checkbox" name="is_featured" defaultChecked={p?.is_featured ?? true} />
        Показывать в «Популярных объектах» на сайте
      </label>
    </>
  );
}
