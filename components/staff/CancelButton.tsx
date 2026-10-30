"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelBooking } from "@/app/staff/actions";
import { t } from "@/lib/i18n";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-rose px-4 py-2 text-sm font-semibold text-onyx disabled:opacity-60"
    >
      {pending ? "…" : t.staff.yesCancel}
    </button>
  );
}

/** Two taps: "Cancel" then "Yes, cancel". */
export function CancelButton({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-rose hover:text-rose-text"
      >
        {t.staff.cancel}
      </button>
    );
  }
  return (
    <form action={cancelBooking} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={t.staff.cancelConfirm}>
      <input type="hidden" name="id" value={id} />
      <span className="text-sm font-medium">{t.staff.cancelConfirm}</span>
      <ConfirmButton />
      <button type="button" onClick={() => setAsking(false)} className="rounded-full border border-line px-4 py-2 text-sm">
        {t.staff.keep}
      </button>
    </form>
  );
}
