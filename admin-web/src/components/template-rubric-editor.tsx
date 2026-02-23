"use client";

import {
  Button,
  Input,
  Section,
  NoticeText,
  ListCard,
  Stack,
  InlineStack
} from "@/components/design-system";
import { useMemo, useState } from "react";
import type { TemplateRubricItem } from "@/lib/pillar-templates";

type AddRubricPayload = {
  activityType: string;
  tier: string;
  label?: string;
  points: number;
  examples?: string;
};

type Props = {
  rubricItems: TemplateRubricItem[];
  busy?: boolean;
  onAdd: (payload: AddRubricPayload) => Promise<void>;
  onUpdate: (rubricItemId: string, payload: { label?: string; points?: number }) => Promise<void>;
  onRemove: (rubricItemId: string) => Promise<void>;
};

type AddForm = {
  activityType: string;
  tier: string;
  label: string;
  points: string;
  examples: string;
};

const EMPTY_ADD_FORM: AddForm = {
  activityType: "",
  tier: "",
  label: "",
  points: "",
  examples: ""
};

export function TemplateRubricEditor({ rubricItems, busy = false, onAdd, onUpdate, onRemove }: Props) {
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { label: string; points: string }>>({});

  const sortedItems = useMemo(() => {
    return [...rubricItems].sort((a, b) => a.label.localeCompare(b.label));
  }, [rubricItems]);

  function draftFor(item: TemplateRubricItem) {
    const draft = drafts[item.id];
    if (draft) {
      return draft;
    }
    return {
      label: item.label,
      points: String(item.points)
    };
  }

  async function submitAdd() {
    setError(null);
    const points = Number(addForm.points);
    if (!Number.isFinite(points) || !Number.isInteger(points)) {
      setError("Points must be an integer.");
      return;
    }
    if (!addForm.activityType.trim() || !addForm.tier.trim()) {
      setError("Activity type and tier are required.");
      return;
    }

    try {
      await onAdd({
        activityType: addForm.activityType.trim(),
        tier: addForm.tier.trim(),
        label: addForm.label.trim() || undefined,
        points,
        examples: addForm.examples.trim() || undefined
      });
      setAddForm(EMPTY_ADD_FORM);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add rubric item.");
    }
  }

  async function saveItem(item: TemplateRubricItem) {
    setError(null);
    const draft = draftFor(item);
    const points = Number(draft.points);
    if (!Number.isFinite(points) || !Number.isInteger(points)) {
      setError("Points must be an integer.");
      return;
    }

    setSavingId(item.id);
    try {
      await onUpdate(item.id, {
        label: draft.label.trim(),
        points
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update rubric item.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeItem(item: TemplateRubricItem) {
    setError(null);
    setSavingId(item.id);
    try {
      await onRemove(item.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to remove rubric item.");
    } finally {
      setSavingId(null);
    }
  }

  return (
      <Section title="Default Rubric Items">
        <Stack gap={2} className="rounded-md border border-[var(--line)] p-3 md:grid-cols-5">
          <Input
          value={addForm.activityType}
          onChange={(event) => setAddForm(current => ({ ...current, activityType: event.target.value }))}
          placeholder="Activity type"
        />
        <Input
          value={addForm.tier}
          onChange={(event) => setAddForm(current => ({ ...current, tier: event.target.value }))}
          placeholder="Tier"
        />
        <Input
          value={addForm.label}
          onChange={(event) => setAddForm(current => ({ ...current, label: event.target.value }))}
          placeholder="Label (optional)"
        />
        <Input
          value={addForm.points}
          onChange={(event) => setAddForm(current => ({ ...current, points: event.target.value }))}
          placeholder="Points"
          className="mono"
        />
        <Button
          disabled={busy}
          onClick={submitAdd}
        >
          Add Item
        </Button>
        <Input
          value={addForm.examples}
          onChange={(event) => setAddForm(current => ({ ...current, examples: event.target.value }))}
          placeholder="Examples (optional)"
          className="md:col-span-5"
        />
        </Stack>

        {error ? (
          <NoticeText className="mb-3">{error}</NoticeText>
        ) : null}

        <Stack gap={2} className="mt-3">
          {sortedItems.map(item => {
            const draft = draftFor(item);
            return (
              <ListCard key={item.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="mono text-xs text-[var(--ink-subtle)]">{item.id}</p>
                  <InlineStack>
                    <Button
                      disabled={busy || savingId === item.id}
                      onClick={() => saveItem(item)}
                    >
                      Save
                    </Button>
                    <Button
                      disabled={busy || savingId === item.id}
                      onClick={() => removeItem(item)}
                    >
                      Remove
                    </Button>
                  </InlineStack>
                </div>

                <div className="grid gap-2 md:grid-cols-[2fr_120px]">
                  <Input
                    value={draft.label}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [item.id]: {
                          ...draft,
                          label: event.target.value
                        }
                      }))
                    }
                  />
                  <Input
                    value={draft.points}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [item.id]: {
                          ...draft,
                          points: event.target.value
                        }
                      }))
                    }
                    className="mono"
                  />
                </div>

                <p className="mt-2 text-xs text-[var(--ink-subtle)]">
                  {item.activityType} · {item.tier}
                  {item.examples ? ` · ${item.examples}` : ""}
                </p>
              </ListCard>
            );
          })}
        </Stack>
      </Section>
  );
}
