export type LeadStatus = "new" | "in_progress" | "qualified" | "converted" | "lost";
export type LeadSource = "website_form" | "ai_chat" | "phone" | "manual";
export type BookingStatus = "pending" | "confirmed" | "checked_in" | "completed" | "cancelled";
export type PropertyKind = "apartment" | "house" | "cottage" | "guest_house" | "camp" | "office" | "commercial";
export type Region = "issyk_kul_north" | "issyk_kul_south" | "bishkek" | "osh" | "other";
export type ClientKind = "guest" | "tenant" | "owner" | "business";
export type KbKind = "company" | "faq" | "service" | "policy" | "article" | "document";
export type Tone = "cream" | "sage" | "rose";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  topic: string | null;
  message: string | null;
  source: LeadSource;
  status: LeadStatus;
  property_id: string | null;
  client_id: string | null;
  assigned_to: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  chat_session_id: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  kind: ClientKind;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  title: string;
  kind: PropertyKind;
  region: Region;
  location: string;
  description: string | null;
  capacity: string | null;
  max_guests: number | null;
  price: number;
  price_unit: "night" | "month";
  features: string[];
  status: "active" | "hidden" | "archived";
  is_featured: boolean;
  sort_order: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  property_id: string;
  client_id: string;
  lead_id: string | null;
  check_in: string;
  check_out: string;
  guests: number | null;
  total_price: number | null;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  tone: Tone;
  sort_order: number;
  is_active: boolean;
};

export type CompanySettings = {
  name: string;
  tagline: string;
  phone: string;
  whatsapp_url: string | null;
  telegram_url: string | null;
  instagram_url: string | null;
  email: string;
  address: string;
  hours: string;
  about: string | null;
  chat_enabled: boolean;
  chat_greeting: string;
  chat_instructions: string | null;
};

export type KbDocument = {
  id: string;
  title: string;
  kind: KbKind;
  content: string;
  source_filename: string | null;
  is_published: boolean;
  indexed_at: string | null;
  embedded_chunks: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
};
