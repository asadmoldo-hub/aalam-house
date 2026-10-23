import { NextResponse } from "next/server";
import { createLead, leadInput } from "@/lib/leads";
import { allow, clientKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Ловушка для ботов: скрытое поле, которое человек не заполняет
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const parsed = leadInput.safeParse({
    name: body.name,
    phone: body.phone,
    topic: body.topic || undefined,
    message: body.message || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid", issues: parsed.error.issues }, { status: 422 });
  }

  if (!(await allow(`lead:${clientKey(req)}`, 5, 3600))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    await createLead(parsed.data, "website_form");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[lead]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
