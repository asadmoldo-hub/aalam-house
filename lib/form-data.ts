// Чтение полей FormData для server actions
export const field = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

export const optional = (fd: FormData, key: string) => field(fd, key) || null;

export const num = (fd: FormData, key: string) => {
  const v = field(fd, key).replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export const bool = (fd: FormData, key: string) => fd.get(key) === "on";

// Сообщение об ошибке Postgres/PostgREST на понятном языке
export function dbError(message: string) {
  if (message.includes("bookings_no_overlap")) return "Объект уже занят на эти даты: пересечение с другой бронью.";
  if (message.includes("bookings_dates_check") || message.includes("leads_dates_check"))
    return "Дата выезда должна быть позже даты заезда.";
  if (message.includes("violates foreign key") && message.includes("bookings"))
    return "Нельзя удалить: есть связанные бронирования. Сначала удалите или переназначьте их.";
  if (message.includes("violates check constraint")) return "Проверьте заполнение полей: значение вне допустимого формата.";
  if (message.includes("row-level security")) return "Недостаточно прав для этого действия.";
  return `Ошибка базы данных: ${message}`;
}
