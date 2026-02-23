import Link from "next/link";

export const metadata = {
  title: "Design System",
  description: "Pillars admin design system index."
};

export default function DesignSystemPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          This is the internal admin design system. Use these pages as the source of truth for primitives.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link href="/design-system/components" className="surface p-4">
            <p className="text-sm font-semibold">Components</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">List of all available DS primitives.</p>
          </Link>
          <Link href="/design-system/button" className="surface p-4">
            <p className="text-sm font-semibold">Button</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">Button states and usage examples.</p>
          </Link>
          <Link href="/design-system/input" className="surface p-4">
            <p className="text-sm font-semibold">Input</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">Input behavior and styling guidance.</p>
          </Link>
          <Link href="/design-system/section" className="surface p-4">
            <p className="text-sm font-semibold">Section</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">Section surface wrapper usage.</p>
          </Link>
          <Link href="/design-system/menu" className="surface p-4">
            <p className="text-sm font-semibold">Menu</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">Menu, MenuItem, and MenuSection composition.</p>
          </Link>
          <Link href="/design-system/list" className="surface p-4">
            <p className="text-sm font-semibold">List</p>
            <p className="mt-1 text-xs text-[var(--ink-subtle)]">List Group and List Item primitives.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
