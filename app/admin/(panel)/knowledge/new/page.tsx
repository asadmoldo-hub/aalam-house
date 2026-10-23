import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { KbFields } from "@/components/admin/KbFields";
import { createKbDocument } from "@/app/admin/actions/content";

export const metadata: Metadata = { title: "Новый материал" };

export default function NewKbPage() {
  return (
    <>
      <div className="a-head">
        <div>
          <div className="a-crumb">
            <Link href="/admin/knowledge">База знаний</Link> / Новый материал
          </div>
          <h1>Новый материал</h1>
          <p>После сохранения текст разбивается на фрагменты и индексируется для поиска</p>
        </div>
      </div>
      <section className="a-card a-card-pad" style={{ maxWidth: 900 }}>
        <ActionForm action={createKbDocument} submitLabel="Сохранить и проиндексировать">
          <KbFields />
        </ActionForm>
      </section>
    </>
  );
}
