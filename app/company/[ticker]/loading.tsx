export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <div className="h-7 w-40 bg-neutral-200 animate-pulse rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-60 bg-neutral-200 animate-pulse rounded" />
        <div className="h-60 bg-neutral-200 animate-pulse rounded" />
      </div>
      <div className="h-40 bg-neutral-200 animate-pulse rounded" />
    </main>
  );
}


