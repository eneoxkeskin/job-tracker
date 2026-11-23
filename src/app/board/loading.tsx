export default function BoardLoading() {
  return (
    <main
      id="main"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl flex-1 px-4 py-6"
    >
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        Your applications
      </h1>
      <p role="status" className="sr-only">
        Loading your applications…
      </p>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, column) => (
          <div key={column} className="space-y-2 rounded-lg bg-slate-100 p-3">
            <div className="h-5 w-24 rounded bg-slate-200 motion-safe:animate-pulse" />
            {Array.from({ length: 3 - (column % 2) }, (_, card) => (
              <div
                key={card}
                className="h-24 rounded-lg bg-slate-200 motion-safe:animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
