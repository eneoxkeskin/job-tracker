import Image from "next/image";
import Link from "next/link";

import { SignOutButton } from "@/components/auth-buttons";
import { getCurrentUser } from "@/lib/session";

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
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
