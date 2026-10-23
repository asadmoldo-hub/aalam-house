import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { company as staticCompany, listings as staticListings, services as staticServices } from "@/lib/content";
import { priceUnitLabel, formatMoney, propertyKindLabel } from "@/lib/labels";
import type { CompanySettings, Property, Service, Tone } from "@/lib/types";

export type LandingData = {
  company: {
    name: string;
    tagline: string;
    phone: string;
    phoneHref: string;
    whatsapp: string;
    telegram: string;
    instagram: string;
    email: string;
    address: string;
    hours: string;
  };
  services: { tone: Tone; kicker: string; title: string; text: string }[];
  listings: {
    id: string | null;
    tone: Tone;
    type: string;
    title: string;
    place: string;
    guests: string;
    price: string;
    unit: string;
    features: string[];
  }[];
  chat: { enabled: boolean; greeting: string };
  live: boolean;
};

const defaultGreeting = "Здравствуйте! Я помощник Аалам Хаус. Помогу подобрать жильё и отвечу на вопросы.";

const tones: Tone[] = ["sage", "rose", "cream"];

// Данные лендинга из Supabase. Если база недоступна, сайт не падает,
// а показывает исходный статический контент.
export async function getLandingData(): Promise<LandingData> {
  try {
    const db = createAdminClient();
    const [settings, services, properties] = await Promise.all([
      db.from("company_settings").select("*").eq("id", 1).single<CompanySettings>(),
      db.from("services").select("*").eq("is_active", true).order("sort_order").returns<Service[]>(),
      db
        .from("properties")
        .select("*")
        .eq("status", "active")
        .eq("is_featured", true)
        .order("sort_order")
        .limit(9)
        .returns<Property[]>(),
    ]);
    if (settings.error || services.error || properties.error) {
      throw new Error(settings.error?.message ?? services.error?.message ?? properties.error?.message);
    }
    const s = settings.data;
    return {
      live: true,
      chat: { enabled: s.chat_enabled, greeting: s.chat_greeting },
      company: {
        name: s.name,
        tagline: s.tagline,
        phone: s.phone,
        phoneHref: `tel:${s.phone.replace(/[^+0-9]/g, "")}`,
        whatsapp: s.whatsapp_url ?? staticCompany.whatsapp,
        telegram: s.telegram_url ?? staticCompany.telegram,
        instagram: s.instagram_url ?? staticCompany.instagram,
        email: s.email,
        address: s.address,
        hours: s.hours,
      },
      services: services.data.map((x) => ({ tone: x.tone, kicker: x.kicker, title: x.title, text: x.description })),
      listings: properties.data.map((p, i) => ({
        id: p.id,
        tone: tones[i % tones.length],
        type: propertyKindLabel[p.kind],
        title: p.title,
        place: p.location,
        guests: p.capacity ?? (p.max_guests ? `до ${p.max_guests} гостей` : ""),
        price: formatMoney(p.price),
        unit: priceUnitLabel[p.price_unit],
        features: p.features,
      })),
    };
  } catch (e) {
    console.error("[landing] fallback to static content:", e instanceof Error ? e.message : e);
    return {
      live: false,
      chat: { enabled: true, greeting: defaultGreeting },
      company: staticCompany,
      services: staticServices.map((s) => ({ ...s })),
      listings: staticListings.map((l) => ({ ...l, id: null })),
    };
  }
}
