"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function SignInForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: initialError });

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-urgent-tint px-3 py-2 text-sm text-urgent">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
