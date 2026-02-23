"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { requestJson } from "@/lib/http-json";
import type { PillarVisualColor, PillarVisualsRecord } from "@/lib/pillar-visuals";
import { resolveColorHexForToken } from "@/lib/pillar-render-registry";

type ColorDraft = {
  label: string;
  order: string;
  isActive: boolean;
};

type CreateColorForm = {
  id: string;
  label: string;
  order: string;
  isActive: boolean;
};

const EMPTY_CREATE_FORM: CreateColorForm = {
  id: "",
  label: "",
  order: "",
  isActive: true
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseOrder(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return parsed;
}

function sortColors(colors: PillarVisualColor[]) {
  return [...colors].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}

export function PillarColorManager() {
  const [visuals, setVisuals] = useState<PillarVisualsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateColorForm>(EMPTY_CREATE_FORM);
  const [drafts, setDrafts] = useState<Record<string, ColorDraft>>({});

  const colors = useMemo(() => sortColors(visuals?.colors || []), [visuals]);

  function draftFor(color: PillarVisualColor): ColorDraft {
    const existing = drafts[color.id];
    if (existing) {
      return existing;
    }
    return {
      label: color.label,
      order: String(color.order),
      isActive: color.isActive !== false
    };
  }

  async function loadVisuals() {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<PillarVisualsRecord>("/api/pillar-visuals");
      setVisuals(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load colors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisuals();
  }, []);

  async function createColor() {
    setError(null);
    const id = normalizeToken(createForm.id);
    if (!id) {
      setError("Color id is required.");
      return;
    }

    const parsedOrder = parseOrder(createForm.order);
    if (Number.isNaN(parsedOrder)) {
      setError("Order must be a non-negative integer.");
      return;
    }

    setBusy(true);
    try {
      const updated = await requestJson<PillarVisualsRecord>("/api/pillar-visuals/colors", {
        method: "POST",
        body: JSON.stringify({
          id,
          label: createForm.label.trim() || id,
          order: parsedOrder,
          isActive: createForm.isActive
        })
      });
      setVisuals(updated);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create color.");
    } finally {
      setBusy(false);
    }
  }

  async function saveColor(color: PillarVisualColor) {
    setError(null);
    const draft = draftFor(color);

    const parsedOrder = parseOrder(draft.order);
    if (Number.isNaN(parsedOrder)) {
      setError(`"${color.id}" order must be a non-negative integer.`);
      return;
    }

    setSavingId(color.id);
    try {
      const updated = await requestJson<PillarVisualsRecord>(`/api/pillar-visuals/colors/${encodeURIComponent(color.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: draft.label.trim() || color.id,
          order: parsedOrder,
          isActive: draft.isActive
        })
      });
      setVisuals(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save color.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeColor(color: PillarVisualColor) {
    setError(null);
    const shouldDelete = window.confirm(`Remove color "${color.id}"?`);
    if (!shouldDelete) {
      return;
    }

    setSavingId(color.id);
    try {
      const updated = await requestJson<PillarVisualsRecord>(`/api/pillar-visuals/colors/${encodeURIComponent(color.id)}`, {
        method: "DELETE"
      });
      setVisuals(updated);
      setDrafts(current => {
        const next = { ...current };
        delete next[color.id];
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to remove color.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pillar Colors</h1>
          <p className="mt-2 text-sm text-[var(--ink-subtle)]">
            Manage color tokens. Clients resolve token rendering from local registries.
          </p>
        </div>
        <Button
          onClick={loadVisuals}
          disabled={loading}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="mono mb-4 rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]">{error}</p>
      ) : null}

      <section className="surface p-4">
        <header className="mb-3">
          <h2 className="text-base font-semibold">Add Color Token</h2>
        </header>

        <div className="grid gap-2 md:grid-cols-[1.2fr_1.2fr_140px_auto]">
          <Input
            value={createForm.id}
            onChange={(event) => setCreateForm(current => ({ ...current, id: event.target.value }))}
            onBlur={(event) => setCreateForm(current => ({ ...current, id: normalizeToken(event.target.value) }))}
            placeholder="color token (orange)"
            className="mono rounded-md border border-[var(--bg-border)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <Input
            value={createForm.label}
            onChange={(event) => setCreateForm(current => ({ ...current, label: event.target.value }))}
            placeholder="label"
            className="rounded-md border border-[var(--bg-border)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <Input
            value={createForm.order}
            onChange={(event) => setCreateForm(current => ({ ...current, order: event.target.value }))}
            placeholder="order"
            className="mono rounded-md border border-[var(--bg-border)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <Button
            onClick={createColor}
            disabled={busy || loading}
            className="mono cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving..." : "Add Color"}
          </Button>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--ink-subtle)]">
          <input
            type="checkbox"
            checked={createForm.isActive}
            onChange={(event) => setCreateForm(current => ({ ...current, isActive: event.target.checked }))}
            className="h-4 w-4 rounded border border-[var(--line-strong)]"
          />
          Active
        </label>
      </section>

      <section className="surface mt-4 p-4">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Palette Tokens</h2>
          {visuals ? (
            <p className="mono text-xs text-[var(--ink-subtle)]">
              Source: {visuals.source} · Updated: {new Date(visuals.updatedAt * 1000).toLocaleString()}
            </p>
          ) : null}
        </header>

        {loading ? (
          <p className="text-sm text-[var(--ink-subtle)]">Loading colors...</p>
        ) : null}

        {!loading && colors.length === 0 ? (
          <p className="text-sm text-[var(--ink-subtle)]">No colors configured.</p>
        ) : null}

        <div className="grid gap-2">
          {colors.map(color => {
            const draft = draftFor(color);
            const isSaving = savingId === color.id;
            return (
              <article key={color.id} className="rounded-md border border-[var(--bg-border)] bg-[var(--bg)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded border border-[var(--bg-border)]"
                      style={{ backgroundColor: resolveColorHexForToken(color.id) }}
                    />
                    <p className="mono text-xs text-[var(--ink-subtle)]">{color.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={isSaving}
                      onClick={() => saveColor(color)}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => removeColor(color)}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1.4fr_120px_auto]">
                  <Input
                    value={draft.label}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [color.id]: {
                          ...draft,
                          label: event.target.value
                        }
                      }))
                    }
                    className="rounded-md border border-[var(--bg-border)] px-2 py-2 text-sm"
                  />
                  <Input
                    value={draft.order}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [color.id]: {
                          ...draft,
                          order: event.target.value
                        }
                      }))
                    }
                    className="mono rounded-md border border-[var(--bg-border)] px-2 py-2 text-sm"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-subtle)]">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDrafts(current => ({
                          ...current,
                          [color.id]: {
                            ...draft,
                            isActive: event.target.checked
                          }
                        }))
                      }
                      className="h-4 w-4 rounded border border-[var(--line-strong)]"
                    />
                    Active
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
