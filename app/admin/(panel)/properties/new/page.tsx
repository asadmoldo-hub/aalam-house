import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/admin/ActionForm";
import { PropertyFields } from "@/components/admin/fields";
import { createProperty } from "@/app/admin/actions/crm";

export const metadata: Metadata = { title: "Новый объект" };

export default async function NewPropertyPage() {
  const supabase = await createClient();
  const { data: owners } = await supabase.from("clients").select("id, full_name").eq("kind", "owner").order("full_name");
  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/properties">Объекты</Link> / Новый
          </div>
          <h1>Новый объект</h1>
        </div>
      </div>
      <section className="a-card a-card-pad" style={{ maxWidth: 900 }}>
        <ActionForm action={createProperty} submitLabel="Создать объект">
          <PropertyFields owners={owners ?? []} />
        </ActionForm>
      </section>
    </>
  );
}
