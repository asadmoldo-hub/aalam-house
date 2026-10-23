"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Показывает уведомление из ?toast= / ?err= после серверного redirect и убирает параметр из URL
export function Toaster() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null);

  useEffect(() => {
    const ok = params.get("toast");
    const err = params.get("err");
    if (!ok && !err) return;
    setToast({ text: (ok ?? err)!, err: !!err });
    const rest = new URLSearchParams(params);
    rest.delete("toast");
    rest.delete("err");
    router.replace(rest.size ? `${path}?${rest}` : path, { scroll: false });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [params, path, router]);

  if (!toast) return null;
  return (
    <div className="a-toasts" role="status" aria-live="polite">
      <div className={toast.err ? "a-toast err" : "a-toast"}>
        {toast.err ? "⚠" : "✓"} {toast.text}
      </div>
    </div>
  );
}
