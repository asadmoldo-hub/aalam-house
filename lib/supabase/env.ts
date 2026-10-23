export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY не заданы");
  }
  return { url, publishableKey };
}
