import { signIn, signOut } from "@/auth";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/session";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        // From a demo, end the demo first. Otherwise Auth.js would link the GitHub account to
        // the signed-in (demo) user; auth-adapter.ts refuses that as a second line of defense.
        if ((await getCurrentUser())?.isDemo) {
          await signOut({ redirect: false });
        }
        await signIn("github", { redirectTo: "/board" });
      }}
    >
      <SubmitButton
        pendingLabel="Redirecting to GitHub…"
        className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-5 font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70"
      >
        Sign in with GitHub
      </SubmitButton>
    </form>
  );
}

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        // For a demo user, Auth.js' signOut event also deletes the demo's data (auth.config.ts).
        await signOut({ redirectTo: "/" });
      }}
    >
      <SubmitButton
        pendingLabel="Signing out…"
        className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {label}
      </SubmitButton>
    </form>
  );
}
