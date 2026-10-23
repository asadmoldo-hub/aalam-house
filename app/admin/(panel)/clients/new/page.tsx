import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { ClientFields } from "@/components/admin/fields";
import { createClientRecord } from "@/app/admin/actions/crm";

export const metadata: Metadata = { title: "Новый клиент" };

export default function NewClientPage() {
  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/clients">Клиенты</Link> / Новый
          </div>
          <h1>Новый клиент</h1>
        </div>
      </div>
      <section className="a-card a-card-pad" style={{ maxWidth: 820 }}>
        <ActionForm action={createClientRecord} submitLabel="Создать клиента">
          <ClientFields />
        </ActionForm>
      </section>
    </>
  );
}
