export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Job Application Tracker
      </h1>
      <p className="text-slate-700">
        Track your job applications from &ldquo;Applied&rdquo; to
        &ldquo;Offer&rdquo; on a Kanban board.
      </p>
    </main>
  );
}
