import { SchemaExplorer } from "@/components/schema-explorer";
import { fetchSchemas } from "@/lib/schemas";

export const dynamic = "force-dynamic";

function ErrorState({ message, sourceUrl }: { message: string; sourceUrl: string }) {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6 md:p-8">
        <p className="mono inline-flex rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--ink)]">Schema fetch failed</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Unable to load `/api/schemas`</h1>
        <p className="mt-3 text-sm text-[var(--ink-subtle)] md:text-base">{message}</p>
        <p className="mono mt-3 text-xs text-[var(--ink-subtle)]">Source: {sourceUrl}</p>
        <div className="mt-6 rounded-md border border-[var(--line)] bg-[var(--bg)] p-4">
          <h2 className="text-sm font-semibold">Checklist</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-subtle)]">
            <li>Set `PILLARS_API_KEY` in your environment.</li>
            <li>Optional: set `PILLARS_API_BASE_URL` for non-production targets.</li>
            <li>Confirm the key can access `/api/schemas`.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default async function SchemasPage() {
  const result = await fetchSchemas();

  if (!result.ok) {
    return <ErrorState message={result.error} sourceUrl={result.sourceUrl} />;
  }

  return (
    <>
      <SchemaExplorer data={result.data} />
      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-8 md:px-8">
        <p className="mono text-xs text-[var(--ink-subtle)]">Source: {result.sourceUrl}</p>
      </footer>
    </>
  );
}
