"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "@/app/staff/actions";
import { t } from "@/lib/i18n";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { sent: false });

  if (state.sent) {
    return (
      <p role="status" className="mt-8 rounded-xl border border-line bg-surface p-5 text-center">
        {t.staff.linkSent}
      </p>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">{t.staff.email}</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          className={`mt-1 w-full rounded-lg border bg-surface px-3 py-3 text-base outline-none focus:border-gold ${
            state.error ? "border-rose" : "border-line"
          }`}
        />
        {state.error && (
          <span role="alert" className="mt-1 block text-sm text-rose-text">
            {t.book.errorEmail}
          </span>
        )}
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gold py-3.5 font-semibold text-onyx transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? t.staff.sending : t.staff.sendLink}
      </button>
    </form>
  );
}
