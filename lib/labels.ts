import type { BookingStatus, ClientKind, KbKind, LeadSource, LeadStatus, PropertyKind, Region } from "./types";

export const leadStatusLabel: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  qualified: "Подобраны варианты",
  converted: "Бронь оформлена",
  lost: "Отказ",
};

export const leadSourceLabel: Record<LeadSource, string> = {
  website_form: "Форма сайта",
  ai_chat: "AI-чат",
  phone: "Звонок",
  manual: "Вручную",
};

export const bookingStatusLabel: Record<BookingStatus, string> = {
  pending: "Ожидает оплаты",
  confirmed: "Подтверждена",
  checked_in: "Гость заселён",
  completed: "Завершена",
  cancelled: "Отменена",
};

export const propertyKindLabel: Record<PropertyKind, string> = {
  apartment: "Квартира",
  house: "Дом",
  cottage: "Коттедж",
  guest_house: "Гостевой дом",
  camp: "База / лагерь",
  office: "Офис",
  commercial: "Коммерческое помещение",
};

export const regionLabel: Record<Region, string> = {
  issyk_kul_north: "Иссык-Куль, северный берег",
  issyk_kul_south: "Иссык-Куль, южный берег",
  bishkek: "Бишкек",
  osh: "Ош",
  other: "Другие города",
};

export const clientKindLabel: Record<ClientKind, string> = {
  guest: "Гость (посуточно)",
  tenant: "Арендатор (долгосрочно)",
  owner: "Владелец объекта",
  business: "Компания",
};

export const clientSourceLabel: Record<string, string> = {
  website_form: "Форма сайта",
  ai_chat: "AI-чат",
  phone: "Звонок",
  referral: "Рекомендация",
  manual: "Вручную",
};

export const kbKindLabel: Record<KbKind, string> = {
  company: "О компании",
  faq: "Вопрос-ответ",
  service: "Услуга",
  policy: "Условия",
  article: "Статья",
  document: "Документ",
};

export const priceUnitLabel = { night: "сутки", month: "месяц" } as const;

const tz = "Asia/Bishkek";

export function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} сом`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(value));
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

// Сегодняшняя дата в часовом поясе Бишкека, YYYY-MM-DD
export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
