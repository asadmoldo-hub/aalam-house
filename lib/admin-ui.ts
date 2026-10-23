import type { BookingStatus, LeadSource, LeadStatus } from "./types";

export const leadStatusTone: Record<LeadStatus, string> = {
  new: "tone-blue",
  in_progress: "tone-amber",
  qualified: "tone-violet",
  converted: "tone-green",
  lost: "tone-gray",
};

export const leadSourceTone: Record<LeadSource, string> = {
  website_form: "tone-gray plain",
  ai_chat: "tone-violet plain",
  phone: "tone-gray plain",
  manual: "tone-gray plain",
};

export const bookingStatusTone: Record<BookingStatus, string> = {
  pending: "tone-amber",
  confirmed: "tone-blue",
  checked_in: "tone-violet",
  completed: "tone-green",
  cancelled: "tone-gray",
};

export const propertyStatusLabel = { active: "Показывается", hidden: "Скрыт", archived: "В архиве" } as const;
export const propertyStatusTone = { active: "tone-green", hidden: "tone-amber", archived: "tone-gray" } as const;

export const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
