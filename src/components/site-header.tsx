import Image from "next/image";
import Link from "next/link";

import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { DEMO_TTL_MS } from "@/features/demo/config";
import { getCurrentUser } from "@/lib/session";

const DEMO_MINUTES = DEMO_TTL_MS / 60_000;

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <Link
          href={user ? "/board" : "/"}
          className="rounded-md py-2 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Job Application Tracker
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            {user.isDemo ? (
              <span className="rounded-full border border-amber-700 bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-900">
                Demo
              </span>
            ) : (
              <>
                {user.image && (
                  <Image
                    src={user.image}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-full"
                  />
                )}
                <span className="hidden text-sm text-slate-700 sm:inline">
                  {user.name ?? user.email ?? "Signed in"}
                </span>
              </>
            )}
            <SignOutButton label={user.isDemo ? "Exit demo" : "Sign out"} />
          </div>
        )}
      </div>
      {user?.isDemo && (
        <section
          aria-labelledby="demo-banner-title"
          className="border-t border-amber-200 bg-amber-50"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
            <p className="text-sm text-amber-950">
              <strong id="demo-banner-title" className="font-semibold">
                You&apos;re using the demo.
              </strong>{" "}
              This board is private to you. It&apos;s deleted when you exit, or
              after {DEMO_MINUTES} minutes.
            </p>
            <SignInButton />
          </div>
        </section>
      )}
    </header>
  );
}
