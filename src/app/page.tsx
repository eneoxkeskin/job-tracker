import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { TryDemoButton } from "@/features/demo/components/try-demo-button";
import { DEMO_TTL_MS } from "@/features/demo/config";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  if (await getCurrentUser()) {
    redirect("/board");
  }

  // Auth.js redirects here with ?error=<code> when sign-in fails (pages.error in auth.config.ts).
  // The code is not shown verbatim: it is user-controllable and not meaningful to end users.
  const { error } = await searchParams;

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16"
    >
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Track every job application in one place
      </h1>
      <p className="text-lg text-slate-700">
        Add your applications, move them from Applied to Interview, Offer or
        Rejected on a Kanban board, and see where you stand at a glance.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          Sign-in failed. Please try again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SignInButton />
        <TryDemoButton />
      </div>
      <p className="text-sm text-slate-700">
        No account needed for the demo: you get your own private board with
        sample applications. It&apos;s deleted when you exit, or after{" "}
        {DEMO_TTL_MS / 60_000} minutes.
      </p>
    </main>
  );
}
