import { Check } from "lucide-react";
import type { FormState } from "@/app/actions/stores";

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-urgent-tint px-3 py-2 text-sm text-urgent">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-ok">
        <Check className="size-4" strokeWidth={2.4} /> {state.ok}
      </p>
    );
  }
  return null;
}
