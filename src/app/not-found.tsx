import Link from "next/link";

import { buttonPrimary } from "@/components/styles";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-700">
        This page or application doesn&apos;t exist, or you don&apos;t have
        access to it.
      </p>
      <Link href="/board" className={`${buttonPrimary} mt-6`}>
        Back to your board
      </Link>
    </main>
  );
}
