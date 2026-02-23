import { Input } from "@/components/design-system";

export const metadata = {
  title: "Design System - Input",
  description: "Input component usage and states."
};

export default function InputPage() {
  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Input</h1>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Core text field style for admin forms.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="surface p-4 space-y-3">
            <div>
              <label htmlFor="ds-input-example" className="text-sm font-semibold">
                Label
              </label>
              <p className="mt-1 text-xs text-[var(--ink-subtle)]">Default state</p>
              <div className="mt-3">
                <Input id="ds-input-example" placeholder="Start typing..." />
              </div>
            </div>

            <div>
              <label htmlFor="ds-input-hover" className="text-sm font-semibold">
                Hover style
              </label>
              <p className="mt-1 text-xs text-[var(--ink-subtle)]">Try focusing this field to preview active state</p>
              <div className="mt-3">
                <Input id="ds-input-hover" placeholder="Hover or focus this input" />
              </div>
            </div>

            <div>
              <label htmlFor="ds-input-disabled" className="text-sm font-semibold">
                Disabled
              </label>
              <p className="mt-1 text-xs text-[var(--ink-subtle)]">Use when an input is unavailable</p>
              <div className="mt-3">
                <Input id="ds-input-disabled" disabled defaultValue="Disabled value" />
              </div>
            </div>

            <div>
              <label htmlFor="ds-input-error" className="text-sm font-semibold">
                Error
              </label>
              <p className="mt-1 text-xs text-[var(--ink-subtle)]">Use explicit error styling for validation</p>
              <div className="mt-3">
                <Input
                  id="ds-input-error"
                  className="border-[var(--error)] focus:border-[var(--error)]"
                  placeholder="Invalid value"
                  defaultValue="abc@"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
