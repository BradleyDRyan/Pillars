"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { requestJson } from "@/lib/http-json";
import type { PillarVisualColor, PillarVisualIcon, PillarVisualsRecord } from "@/lib/pillar-visuals";
import { iconBadge, resolveColorHexForToken } from "@/lib/pillar-render-registry";

type IconDraft = {
  label: string;
  defaultColorToken: string;
  order: string;
  isActive: boolean;
};

type CreateIconForm = {
  id: string;
  label: string;
  defaultColorToken: string;
  order: string;
  isActive: boolean;
};

const EMPTY_CREATE_FORM: CreateIconForm = {
  id: "",
  label: "",
  defaultColorToken: "",
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

function sortRows<T extends { order: number; id: string }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}

function colorLabel(color: PillarVisualColor) {
  return `${color.id} · ${color.label}${color.isActive ? "" : " (inactive)"}`;
}

export function PillarIconManager() {
  const [visuals, setVisuals] = useState<PillarVisualsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateIconForm>(EMPTY_CREATE_FORM);
  const [drafts, setDrafts] = useState<Record<string, IconDraft>>({});

  const colors = useMemo(() => sortRows(visuals?.colors || []), [visuals]);
  const icons = useMemo(() => sortRows(visuals?.icons || []), [visuals]);
  const colorById = useMemo(() => {
    const map = new Map<string, PillarVisualColor>();
    for (const color of colors) {
      map.set(color.id, color);
    }
    return map;
  }, [colors]);

  function draftFor(icon: PillarVisualIcon): IconDraft {
    const existing = drafts[icon.id];
    if (existing) {
      return existing;
    }
    return {
      label: icon.label,
      defaultColorToken: icon.defaultColorToken || "",
      order: String(icon.order),
      isActive: icon.isActive !== false
    };
  }

  async function loadVisuals() {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<PillarVisualsRecord>("/api/pillar-visuals");
      setVisuals(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load icons.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisuals();
  }, []);

  async function createIcon() {
    setError(null);
    const id = normalizeToken(createForm.id);
    const colorToken = normalizeToken(createForm.defaultColorToken);
    if (!id) {
      setError("Icon id is required.");
      return;
    }
    if (colorToken && !colorById.has(colorToken)) {
      setError("Default color token must match a configured color id.");
      return;
    }

    const parsedOrder = parseOrder(createForm.order);
    if (Number.isNaN(parsedOrder)) {
      setError("Order must be a non-negative integer.");
      return;
    }

    setBusy(true);
    try {
      const updated = await requestJson<PillarVisualsRecord>("/api/pillar-visuals/icons", {
        method: "POST",
        body: JSON.stringify({
          id,
          label: createForm.label.trim() || id,
          defaultColorToken: colorToken || null,
          order: parsedOrder,
          isActive: createForm.isActive
        })
      });
      setVisuals(updated);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create icon.");
    } finally {
      setBusy(false);
    }
  }

  async function saveIcon(icon: PillarVisualIcon) {
    setError(null);
    const draft = draftFor(icon);
    const colorToken = normalizeToken(draft.defaultColorToken);
    if (colorToken && !colorById.has(colorToken)) {
      setError(`"${icon.id}" default color token must match a configured color id.`);
      return;
    }

    const parsedOrder = parseOrder(draft.order);
    if (Number.isNaN(parsedOrder)) {
      setError(`"${icon.id}" order must be a non-negative integer.`);
      return;
    }

    setSavingId(icon.id);
    try {
      const updated = await requestJson<PillarVisualsRecord>(`/api/pillar-visuals/icons/${encodeURIComponent(icon.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: draft.label.trim() || icon.id,
          defaultColorToken: colorToken || null,
          order: parsedOrder,
          isActive: draft.isActive
        })
      });
      setVisuals(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save icon.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeIcon(icon: PillarVisualIcon) {
    setError(null);
    const shouldDelete = window.confirm(`Remove icon "${icon.id}"?`);
    if (!shouldDelete) {
      return;
    }

    setSavingId(icon.id);
    try {
      const updated = await requestJson<PillarVisualsRecord>(`/api/pillar-visuals/icons/${encodeURIComponent(icon.id)}`, {
        method: "DELETE"
      });
      setVisuals(updated);
      setDrafts(current => {
        const next = { ...current };
        delete next[icon.id];
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to remove icon.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="fade-in mx-auto w-full max-w-[1240px] px-4 py-8 md:px-8 max-h-[100vh]">
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pillar Icons</h1>
          <p className="mt-2 text-sm text-[var(--ink-subtle)]">
            Manage icon tokens and their default color tokens. Rendering is client-local.
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
          <h2 className="text-base font-semibold">Add Icon Token</h2>
        </header>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_120px_auto]">
          <Input
            value={createForm.id}
            onChange={(event) => setCreateForm(current => ({ ...current, id: event.target.value }))}
            onBlur={(event) => setCreateForm(current => ({ ...current, id: normalizeToken(event.target.value) }))}
            placeholder="icon token (heart)"
            className="mono rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <Input
            value={createForm.label}
            onChange={(event) => setCreateForm(current => ({ ...current, label: event.target.value }))}
            placeholder="label"
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <select
            value={createForm.defaultColorToken}
            onChange={(event) => setCreateForm(current => ({ ...current, defaultColorToken: event.target.value }))}
            className="mono rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
          >
            <option value="">No default color</option>
            {colors.map(color => (
              <option key={color.id} value={color.id}>
                {colorLabel(color)}
              </option>
            ))}
          </select>
          <Input
            value={createForm.order}
            onChange={(event) => setCreateForm(current => ({ ...current, order: event.target.value }))}
            placeholder="order"
            className="mono rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
          />
          <Button
            onClick={createIcon}
            disabled={busy || loading}
            className="mono cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving..." : "Add Icon"}
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
          <h2 className="text-base font-semibold">Icon Tokens</h2>
          {visuals ? (
            <p className="mono text-xs text-[var(--ink-subtle)]">
              Source: {visuals.source} · Updated: {new Date(visuals.updatedAt * 1000).toLocaleString()}
            </p>
          ) : null}
        </header>

        {loading ? (
          <p className="text-sm text-[var(--ink-subtle)]">Loading icons...</p>
        ) : null}

        {!loading && icons.length === 0 ? (
          <p className="text-sm text-[var(--ink-subtle)]">No icons configured.</p>
        ) : null}

        <div className="grid gap-2">
          {icons.map(icon => {
            const draft = draftFor(icon);
            const isSaving = savingId === icon.id;
            const colorToken = icon.defaultColorToken || null;
            const color = colorToken ? colorById.get(colorToken) : null;

            return (
              <article key={icon.id} className="rounded-md border border-[var(--line)] bg-[var(--bg)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="mono inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--line)] text-[11px] text-[var(--ink-subtle)]">
                      {iconBadge(icon.id)}
                    </span>
                    <p className="mono text-xs text-[var(--ink-subtle)]">{icon.id}</p>
                    {colorToken ? (
                      <span className="inline-flex items-center gap-1 rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-[var(--ink-subtle)]">
                        <span
                          className="h-3.5 w-3.5 rounded border border-[var(--line)]"
                          style={{ backgroundColor: resolveColorHexForToken(colorToken) }}
                        />
                        {color?.id || colorToken}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={isSaving}
                      onClick={() => saveIcon(icon)}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => removeIcon(icon)}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_120px_auto]">
                  <Input
                    value={draft.label}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [icon.id]: {
                          ...draft,
                          label: event.target.value
                        }
                      }))
                    }
                    className="rounded-md border border-[var(--line)] px-2 py-2 text-sm"
                  />
                  <select
                    value={draft.defaultColorToken}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [icon.id]: {
                          ...draft,
                          defaultColorToken: event.target.value
                        }
                      }))
                    }
                    className="mono rounded-md border border-[var(--line)] px-2 py-2 text-sm"
                  >
                    <option value="">No default color</option>
                    {colors.map(colorOption => (
                      <option key={colorOption.id} value={colorOption.id}>
                        {colorLabel(colorOption)}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={draft.order}
                    onChange={(event) =>
                      setDrafts(current => ({
                        ...current,
                        [icon.id]: {
                          ...draft,
                          order: event.target.value
                        }
                      }))
                    }
                    className="mono rounded-md border border-[var(--line)] px-2 py-2 text-sm"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-subtle)]">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDrafts(current => ({
                          ...current,
                          [icon.id]: {
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
