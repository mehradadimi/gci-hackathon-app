'use client';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-neutral-700">{error.message}</p>
    </main>
  );
}


