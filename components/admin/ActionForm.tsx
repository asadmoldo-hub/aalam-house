"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string } | null;

// Форма поверх server action: индикатор отправки, ошибки валидации и базы
export function ActionForm({
  action,
  children,
  submitLabel = "Сохранить",
  className = "a-form",
  extra,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  extra?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <div className="a-alert err" role="alert">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="a-alert ok" role="status">
          {state.ok}
        </div>
      )}
      <div className="a-form-foot">
        <SubmitButton label={submitLabel} />
        {extra}
      </div>
    </form>
  );
}

export function SubmitButton({ label, className = "a-btn a-btn-primary" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <span className="a-spin" aria-hidden />}
      {pending ? "Сохраняем…" : label}
    </button>
  );
}

// Кнопка опасного действия с подтверждением
export function ConfirmButton({
  action,
  label,
  confirmText,
  className = "a-btn a-btn-danger",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <SubmitButton label={label} className={className} />
    </form>
  );
}
