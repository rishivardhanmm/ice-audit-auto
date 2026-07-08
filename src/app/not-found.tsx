import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center">
      <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-audit">
        <h1 className="text-2xl font-semibold text-zinc-950">Not found</h1>
        <p className="mt-2 text-sm text-zinc-500">The requested audit could not be loaded.</p>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white">
          Workspace
        </Link>
      </section>
    </main>
  );
}
