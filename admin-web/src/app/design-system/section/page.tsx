import { Section } from "@/components/design-system";

export const metadata = {
  title: "Design System - Section",
  description: "Section surface wrapper usage and examples."
};

export default function SectionPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Section</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Use this wrapper for grouped content blocks in admin views.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-normal text-[var(--ink-subtle)]">With title</h3>
            <Section>
            <p className="text-sm text-[var(--ink-subtle)]">This section shows the default title layout.</p>
            </Section>
          </div>

          <div>
            <Section>
              <p className="text-sm text-[var(--ink-subtle)]">This section has no title and only exposes raw body content.</p>
            </Section>
          </div>
        </div>
      </section>
    </main>
  );
}
