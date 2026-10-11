import Link from "next/link";

/** Placeholder for screens not built yet. Replace the page body when its issue is picked up. */
export function RouteStub({ title, issue, detail }: { title: string; issue: string; detail?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <Link href="/" className="text-sm text-[#cc0033]">
        ← Home
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {detail && <p className="break-all text-sm text-zinc-500">{detail}</p>}
      <p className="text-zinc-600 dark:text-zinc-400">Not built yet ({issue}).</p>
    </main>
  );
}
