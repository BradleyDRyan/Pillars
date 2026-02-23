import { Button } from "@/components/design-system";

export const metadata = {
  title: "Design System - Button",
  description: "Button component usage and states."
};

export default function ButtonPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Button</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Use this component for all admin actions that require an interactive button.
        </p>

        <div className="mt-4 space-y-3">
          <div className="surface p-4">
            <p className="text-sm font-semibold">Examples</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
