"use client";

import { Button } from "@base-ui/react/button";
import { Checkbox } from "@base-ui/react/checkbox";
import { Input } from "@base-ui/react/input";

export type PillarTemplateFormState = {
  pillarType: string;
  name: string;
  description: string;
  icon: string;
  colorToken: string;
  order: string;
  isActive: boolean;
};

type Props = {
  title: string;
  value: PillarTemplateFormState;
  submitLabel: string;
  busy?: boolean;
  showTypeField?: boolean;
  onChange: (next: PillarTemplateFormState) => void;
  onSubmit: () => void;
};

function updateField(
  value: PillarTemplateFormState,
  field: keyof PillarTemplateFormState,
  nextValue: string | boolean
) {
  return {
    ...value,
    [field]: nextValue
  };
}

export function PillarTemplateForm({
  title,
  value,
  submitLabel,
  busy = false,
  showTypeField = false,
  onChange,
  onSubmit
}: Props) {
  return (
    <section className="bg-[var(--bg-surface)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {showTypeField ? (
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">pillarType</span>
            <Input
              value={value.pillarType}
              onChange={(event) => onChange(updateField(value, "pillarType", event.target.value))}
              placeholder="mental_fitness"
              className="mono w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">name</span>
          <Input
            value={value.name}
            onChange={(event) => onChange(updateField(value, "name", event.target.value))}
            className="w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">description</span>
          <Input
            value={value.description}
            onChange={(event) => onChange(updateField(value, "description", event.target.value))}
            className="w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">icon</span>
          <Input
            value={value.icon}
            onChange={(event) => onChange(updateField(value, "icon", event.target.value))}
            placeholder="heart"
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">colorToken</span>
          <Input
            value={value.colorToken}
            onChange={(event) => onChange(updateField(value, "colorToken", event.target.value))}
            placeholder="green"
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">order</span>
          <Input
            value={value.order}
            onChange={(event) => onChange(updateField(value, "order", event.target.value))}
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="flex items-center gap-2 pt-6">
          <Checkbox.Root
            checked={value.isActive}
            onCheckedChange={(isChecked) => onChange(updateField(value, "isActive", isChecked))}
            className="inline-flex h-4 w-4 items-center justify-center rounded border border-[var(--line-strong)] bg-[var(--bg-surface)]"
          >
            <Checkbox.Indicator className="text-xs font-semibold text-[var(--accent)]">✓</Checkbox.Indicator>
          </Checkbox.Root>
          <span className="text-sm text-[var(--ink-subtle)]">Active template</span>
        </label>
      </div>

      <div className="mt-4">
        <Button
          onClick={onSubmit}
          disabled={busy}
          className="mono cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving..." : submitLabel}
        </Button>
      </div>
    </section>
  );
}
