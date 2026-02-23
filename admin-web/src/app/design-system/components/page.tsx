import Link from "next/link";

export const metadata = {
  title: "Design System Components",
  description: "A catalog of available design system primitives."
};

const items = [
  { name: "Button", href: "/design-system/button", description: "Primary button primitive for admin actions." },
  { name: "Input", href: "/design-system/input", description: "Text input primitive with base focus and validation styling." },
  { name: "Menu", href: "/design-system/menu", description: "Navigation primitives for side menus and nested sections." }
];

export default function ComponentsIndexPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Components</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Current primitives available in the admin design system.
        </p>
        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <Link key={item.name} href={item.href} className="surface p-4">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-1 text-xs text-[var(--ink-subtle)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
