"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
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
    <section className="surface p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">Default Rubric Items</h2>
      </header>

      {error ? (
        <p className="mono mb-3 rounded bg-[var(--bg-elevated)] px-2 py-2 text-xs text-[var(--ink)]">{error}</p>
      ) : null}

      <div className="grid gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)] p-3 md:grid-cols-5">
        <Input
          value={addForm.activityType}
          onChange={(event) => setAddForm(current => ({ ...current, activityType: event.target.value }))}
          placeholder="Activity type"
          className="rounded-md border border-[var(--line)] px-2 py-2 text-sm"
        />
        <Input
          value={addForm.tier}
          onChange={(event) => setAddForm(current => ({ ...current, tier: event.target.value }))}
          placeholder="Tier"
          className="rounded-md border border-[var(--line)] px-2 py-2 text-sm"
        />
        <Input
          value={addForm.label}
          onChange={(event) => setAddForm(current => ({ ...current, label: event.target.value }))}
          placeholder="Label (optional)"
          className="rounded-md border border-[var(--line)] px-2 py-2 text-sm"
        />
        <Input
          value={addForm.points}
          onChange={(event) => setAddForm(current => ({ ...current, points: event.target.value }))}
          placeholder="Points"
          className="mono rounded-md border border-[var(--line)] px-2 py-2 text-sm"
        />
        <Button
          disabled={busy}
          onClick={submitAdd}
          className="mono cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Item
        </Button>
        <Input
          value={addForm.examples}
          onChange={(event) => setAddForm(current => ({ ...current, examples: event.target.value }))}
          placeholder="Examples (optional)"
          className="rounded-md border border-[var(--line)] px-2 py-2 text-sm md:col-span-5"
        />
      </div>

      <div className="mt-3 grid gap-2">
        {sortedItems.map(item => {
          const draft = draftFor(item);
          return (
            <article key={item.id} className="rounded-md border border-[var(--line)] bg-[var(--bg)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="mono text-xs text-[var(--ink-subtle)]">{item.id}</p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={busy || savingId === item.id}
                    onClick={() => saveItem(item)}
                    className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </Button>
                  <Button
                    disabled={busy || savingId === item.id}
                    onClick={() => removeItem(item)}
                    className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </Button>
                </div>
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
                  className="rounded-md border border-[var(--line)] px-2 py-2 text-sm"
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
                  className="mono rounded-md border border-[var(--line)] px-2 py-2 text-sm"
                />
              </div>

              <p className="mt-2 text-xs text-[var(--ink-subtle)]">
                {item.activityType} · {item.tier}
                {item.examples ? ` · ${item.examples}` : ""}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
