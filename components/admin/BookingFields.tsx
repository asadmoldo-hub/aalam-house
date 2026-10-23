import { bookingStatusLabel, formatMoney, priceUnitLabel } from "@/lib/labels";
import type { Booking } from "@/lib/types";

export function BookingFields({
  b,
  properties,
  clients,
}: {
  b?: Partial<Booking>;
  properties: { id: string; title: string; price: number; price_unit: "night" | "month" }[];
  clients: { id: string; full_name: string; phone: string | null }[];
}) {
  return (
    <>
      <input type="hidden" name="lead_id" defaultValue={b?.lead_id ?? ""} />
      <div className="a-form-grid">
        <label className="a-field">
          <span>Объект *</span>
          <select className="a-select" name="property_id" required defaultValue={b?.property_id ?? ""}>
            <option value="" disabled>
              — выберите —
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {formatMoney(p.price)}/{priceUnitLabel[p.price_unit]}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Клиент *</span>
          <select className="a-select" name="client_id" required defaultValue={b?.client_id ?? ""}>
            <option value="" disabled>
              — выберите —
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
          <small>
            Нет в списке? <a href="/admin/clients/new">Создайте клиента</a>
          </small>
        </label>
        <label className="a-field">
          <span>Заезд *</span>
          <input className="a-input" type="date" name="check_in" required defaultValue={b?.check_in ?? ""} />
        </label>
        <label className="a-field">
          <span>Выезд *</span>
          <input className="a-input" type="date" name="check_out" required defaultValue={b?.check_out ?? ""} />
        </label>
        <label className="a-field">
          <span>Гостей</span>
          <input className="a-input" name="guests" inputMode="numeric" defaultValue={b?.guests ?? ""} />
        </label>
        <label className="a-field">
          <span>Сумма, сом</span>
          <input className="a-input" name="total_price" inputMode="decimal" defaultValue={b?.total_price ?? ""} />
          <small>Пусто — рассчитать по цене объекта</small>
        </label>
        <label className="a-field">
          <span>Статус</span>
          <select className="a-select" name="status" defaultValue={b?.status ?? "pending"}>
            {Object.entries(bookingStatusLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="a-field">
        <span>Комментарий</span>
        <textarea className="a-textarea" name="notes" maxLength={5000} defaultValue={b?.notes ?? ""} />
      </label>
    </>
  );
}
