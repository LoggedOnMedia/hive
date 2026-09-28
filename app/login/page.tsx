import type { Metadata } from "next";
import { HiveLogo, Hexagon } from "@/components/brand/logo";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "no-profile": "Your account isn't set up yet. Please contact Logged On Media.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const initialError = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="flex min-h-dvh">
      {/* Brand panel — desktop only */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-chrome p-12 md:flex">
        <HiveLogo tone="light" className="h-12 w-auto self-start" />
        <div className="pointer-events-none absolute -right-10 top-1/2 h-96 w-96 -translate-y-1/2" aria-hidden="true">
          <Hexagon className="absolute left-0 top-0 h-56 text-gold/15" />
          <Hexagon className="absolute left-28 top-40 h-56 text-gold/25" />
          <Hexagon className="absolute left-60 top-6 h-28 text-gold/10" />
        </div>
        <p className="relative max-w-sm text-3xl font-bold leading-tight text-white">
          Every store. Every message. <span className="text-gold">Accounted for.</span>
        </p>
      </div>

      <div className="flex flex-1 flex-col bg-canvas">
        <div className="flex h-16 items-center bg-chrome px-4 md:hidden">
          <HiveLogo tone="light" className="h-8 w-auto" />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
            <p className="mb-8 mt-1 text-sm text-muted">Use the login Logged On Media set up for you.</p>
            <SignInForm initialError={initialError} />
          </div>
        </div>
      </div>
    </div>
  );
}
