"use client";

import { useActionState, useState } from "react";
import {
  createStore,
  createStoreManager,
  resetManagerPassword,
  updateStoreDepartments,
  updateStoreDetails,
  type FormState,
} from "@/app/actions/stores";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import type { Department, StoreDepartment } from "@/lib/stores";

const initial: FormState = {};

/** Toggle list shared by "new store" and "edit departments". */
function DepartmentRows({
  departments,
  withEmail,
}: {
  departments: (Department & { enabled?: boolean; email?: string | null })[];
  withEmail: boolean;
}) {
  const [on, setOn] = useState(() => new Set(departments.filter((d) => d.enabled !== false).map((d) => d.id)));
  const set = (id: string, value: boolean) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {departments.map((d) => {
        const enabled = on.has(d.id);
        return (
          <li key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <Toggle name="department" value={d.id} checked={enabled} onChange={(v) => set(d.id, v)} label={d.name} />
              <span className={cn("text-sm font-medium", enabled ? "text-ink" : "text-faint")}>{d.name}</span>
              {!enabled && <span className="text-xs text-faint">Not at this store</span>}
            </div>
            {withEmail && (
              <input
                name={`email:${d.id}`}
                type="email"
                defaultValue={d.email ?? ""}
                placeholder={enabled ? "department@store.co.za" : ""}
                aria-label={`${d.name} email`}
                className={cn(inputClass, "h-10 sm:w-72", !enabled && "opacity-40")}
                readOnly={!enabled}
                tabIndex={enabled ? undefined : -1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function NewStoreForm({ departments }: { departments: Department[] }) {
  const [state, action, pending] = useActionState(createStore, initial);
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Store name">
          <input name="name" required placeholder="e.g. Grove TOPS" className={inputClass} />
        </Field>
        <Field label="Location" hint="Optional">
          <input name="location" placeholder="e.g. Nelspruit" className={inputClass} />
        </Field>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Departments</p>
        <p className="mb-3 mt-0.5 text-sm text-muted">Switch off any this store doesn&apos;t have.</p>
        <DepartmentRows departments={departments} withEmail={false} />
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create store"}
        </Button>
      </div>
    </form>
  );
}

export function StoreDetailsForm({ storeId, name, location }: { storeId: string; name: string; location: string | null }) {
  const [state, action, pending] = useActionState(updateStoreDetails.bind(null, storeId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Store name">
        <input name="name" required defaultValue={name} className={inputClass} />
      </Field>
      <Field label="Location">
        <input name="location" defaultValue={location ?? ""} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DepartmentsForm({ storeId, departments }: { storeId: string; departments: StoreDepartment[] }) {
  const [state, action, pending] = useActionState(updateStoreDepartments.bind(null, storeId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <DepartmentRows departments={departments} withEmail />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save departments"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CreateManagerForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState(createStoreManager.bind(null, storeId), initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Full name">
        <input name="full_name" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Email" hint="They sign in with this.">
        <input name="email" type="email" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Temporary password" hint="At least 8 characters. Share it with them during onboarding.">
        <input name="password" type="text" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create login"}
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState(resetManagerPassword.bind(null, storeId), initial);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Reset password
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="text" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Updating…" : "Set password"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
