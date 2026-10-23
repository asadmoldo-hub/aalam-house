import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/Sidebar";
import { Toaster } from "@/components/admin/Toaster";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new");

  return (
    <div className="a-shell">
      <Sidebar name={staff.fullName} role={staff.role} newLeads={count ?? 0} />
      <main className="a-main">{children}</main>
      <Suspense>
        <Toaster />
      </Suspense>
    </div>
  );
}
