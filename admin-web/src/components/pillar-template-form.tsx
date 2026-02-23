"use client";

import { Button, Input, Section, Select, Checkbox, Stack } from "@/components/design-system";
import { TemplateIconToken, templateColorTokens } from "@/lib/pillar-template-icons";

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
  hideSubmit?: boolean;
  iconOptions?: readonly string[];
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
  hideSubmit = false,
  iconOptions = [],
  onChange,
  onSubmit
}: Props) {
  const iconOptionsSet = new Set<string>([
    ...Object.values(TemplateIconToken),
    ...iconOptions
  ]);
  const sortedIconOptions = Array.from(iconOptionsSet).sort((left, right) => left.localeCompare(right));

  return (
      <Section title={title}>
        <Stack gap={3} className="md:grid-cols-2">
          {showTypeField ? (
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">pillarType</span>
              <Input
                value={value.pillarType}
                onChange={(event) => onChange(updateField(value, "pillarType", event.target.value))}
                placeholder="mental_fitness"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">name</span>
            <Input
              value={value.name}
              onChange={(event) => onChange(updateField(value, "name", event.target.value))}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">description</span>
            <Input
              value={value.description}
              onChange={(event) => onChange(updateField(value, "description", event.target.value))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">icon</span>
            <Select
              value={value.icon}
              onChange={(event) => onChange(updateField(value, "icon", event.target.value))}
              className="mono"
            >
              <option value="">Default</option>
              {sortedIconOptions.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">color token</span>
            <Select
              value={value.colorToken}
              onChange={(event) => onChange(updateField(value, "colorToken", event.target.value))}
              className="mono"
            >
              <option value="">Default</option>
              {templateColorTokens.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">order</span>
            <Input
              value={value.order}
              onChange={(event) => onChange(updateField(value, "order", event.target.value))}
              className="mono"
            />
          </label>

          <label className="flex items-center gap-2 pt-6">
            <Checkbox.Root
              checked={value.isActive}
              onCheckedChange={(isChecked) => onChange(updateField(value, "isActive", isChecked === true))}
            >
              <Checkbox.Indicator>✓</Checkbox.Indicator>
            </Checkbox.Root>
            <span className="text-sm text-[var(--ink-subtle)]">Active template</span>
          </label>
        </Stack>

        {!hideSubmit ? (
          <Stack gap={2} className="mt-4">
            <Button
              buttonType="button"
              onClick={onSubmit}
              disabled={busy}
            >
              {busy ? "Saving..." : submitLabel}
            </Button>
          </Stack>
        ) : null}
      </Section>
  );
}
