import { signIn, signOut } from "@/auth";
import { SubmitButton } from "@/components/submit-button";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
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

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <SubmitButton
        pendingLabel="Signing out…"
        className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Sign out
      </SubmitButton>
    </form>
  );
}
