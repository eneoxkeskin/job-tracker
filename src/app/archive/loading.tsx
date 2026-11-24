export default function ArchiveLoading() {
  return (
    <main
      id="main"
      aria-busy="true"
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"
    >
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Archive</h1>
      <p role="status" className="sr-only">
        Loading your archive…
      </p>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: 3 }, (_, row) => (
          <div
            key={row}
            className="h-20 rounded-lg bg-slate-200 motion-safe:animate-pulse"
          />
        ))}
      </div>
    </main>
  );
}
