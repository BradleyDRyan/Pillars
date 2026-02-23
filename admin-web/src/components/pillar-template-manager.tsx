"use client";

import { useEffect, useMemo, useState } from "react";
import { TertiaryButton, Button, ListGroup, ListItem, PrimaryButton, Section } from "@/components/design-system";
import { requestJson } from "@/lib/http-json";
import type { PillarTemplateRecord } from "@/lib/pillar-templates";
import { PageView, PageViewHeader, PageViewContent } from "@/components/design-system";
import { PillarTemplateForm, type PillarTemplateFormState } from "@/components/pillar-template-form";
import { TemplateRubricEditor } from "@/components/template-rubric-editor";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTemplateIcon } from "@/lib/pillar-template-icons";

const EMPTY_CREATE_FORM: PillarTemplateFormState = {
  pillarType: "",
  name: "",
  description: "",
  icon: "",
  colorToken: "",
  order: "100",
  isActive: true
};

function normalizeTemplateType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function findTemplateByPathType(templates: PillarTemplateRecord[], pathType: string | null | undefined) {
  const normalized = normalizeTemplateType(pathType);
  if (!normalized) return null;

  return (
    templates.find((template) => template.pillarType.toLowerCase() === normalized) || null
  );
}

function toEditForm(template: PillarTemplateRecord): PillarTemplateFormState {
  return {
    pillarType: template.pillarType,
    name: template.name || "",
    description: template.description || "",
    icon: template.icon || "",
    colorToken: template.colorToken || "",
    order: String(template.order ?? 0),
    isActive: template.isActive !== false
  };
}

type PillarTemplateManagerProps = {
  listOnly?: boolean;
  selectedType?: string | null;
  detailsOnly?: boolean;
};

export function PillarTemplateManager({
  listOnly = false,
  selectedType: selectedTypeFromPath,
  detailsOnly = false
}: PillarTemplateManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [templates, setTemplates] = useState<PillarTemplateRecord[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(selectedTypeFromPath || null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<PillarTemplateFormState>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<PillarTemplateFormState | null>(null);

  const selectedTemplateFromPath = useMemo(
    () => (detailsOnly ? findTemplateByPathType(templates, selectedTypeFromPath) : null),
    [templates, selectedTypeFromPath, detailsOnly]
  );
  const activeTemplateType = useMemo(() => {
    if (!pathname) {
      return null;
    }

    const match = pathname.match(/^\/pillars\/templates\/([^/?#]+)/);
    if (!match) {
      return null;
    }

    return normalizeTemplateType(match[1]);
  }, [pathname]);

  const selectedTemplateType = useMemo(
    () => normalizeTemplateType(selectedType),
    [selectedType]
  );
  const selectedTemplate = useMemo(
    () => (
      detailsOnly
        ? selectedTemplateFromPath
        : templates.find(item => item.pillarType === selectedType) || null
    ),
    [detailsOnly, selectedTemplateFromPath, templates, selectedType]
  );

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const rows = await requestJson<PillarTemplateRecord[]>("/api/pillar-templates?includeInactive=true");
      const sorted = [...rows].sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });
      setTemplates(sorted);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (detailsOnly) {
      if (!selectedTemplateFromPath && selectedTypeFromPath) {
        setSelectedType(selectedTypeFromPath);
      }
      return;
    }

    if (listOnly) {
      return;
    }

    if (!selectedType && templates.length > 0) {
      setSelectedType(templates[0]?.pillarType || null);
    }
  }, [templates, selectedType, selectedTemplateFromPath, selectedTypeFromPath, detailsOnly, listOnly]);

  const detailTitle = selectedTemplate?.name || selectedTypeFromPath || "Template";

  useEffect(() => {
    if (!selectedTemplate) {
      setEditForm(null);
      return;
    }
    setEditForm(toEditForm(selectedTemplate));
  }, [selectedTemplate]);

  if (listOnly) {
    return (
      <PageView>
        <PageViewHeader className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pillar Templates</h1>
          </div>
        </PageViewHeader>
        <PageViewContent>
          <Section title={null} className="mx-[56px] my-6">
            {error ? (
              <div className="mb-3 space-y-2">
                <p className="mono rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]">{error}</p>
                <Button buttonType="button" onClick={loadTemplates} className="mono text-xs" disabled={loading}>
                  Retry
                </Button>
              </div>
            ) : null}
            {loading ? <p className="text-sm text-[var(--ink-subtle)]">Loading...</p> : null}
            <ListGroup>
              {templates.map(template => (
                <ListItem
                  key={template.pillarType}
                  href={`/pillars/templates/${encodeURIComponent(template.pillarType)}`}
                  active={false}
                  icon={getTemplateIcon(template.icon, { size: 14 })}
                  aria-label={`Open template ${template.name}`}
                >
                  {template.name}
                </ListItem>
              ))}
            </ListGroup>
          </Section>
        </PageViewContent>
      </PageView>
    );
  }

  if (detailsOnly) {
    const resolvedForm = selectedTemplate ? toEditForm(selectedTemplate) : null;
    const editFormValue = editForm ?? resolvedForm;

    return (
      <PageView>
        <PageViewHeader className="relative flex flex-wrap items-center justify-between gap-3">
          <TertiaryButton
            buttonType="button"
            onClick={() => router.push("/pillars/templates")}
            className="admin-page-view__back absolute left-[4px] top-[4px] inline-flex items-center gap-1.5 border-0 bg-transparent px-0 py-0 text-xs font-medium transition-colors hover:text-[var(--ink)]"
            aria-label="Back to Pillars"
          >
            <ChevronLeft size={14} />
            Pillars
          </TertiaryButton>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{detailTitle}</h1>
          </div>
        </PageViewHeader>
        <PageViewContent>
          {error ? (
            <div className="mb-4 space-y-2">
              <p className="mono rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]">{error}</p>
              <Button buttonType="button" onClick={loadTemplates} className="mono text-xs" disabled={loading}>
                Retry
              </Button>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-[var(--ink-subtle)]">Loading...</p>
          ) : (
            <section className="grid gap-4">
              {selectedTemplate ? (
                <>
                  <PillarTemplateForm
                    title={selectedTemplate.name}
                    value={editFormValue}
                    submitLabel="Save Template"
                    busy={busy}
                    onChange={setEditForm}
                    onSubmit={saveTemplate}
                  />

                  <div className="surface p-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.isActive ? (
                        <Button
                          disabled={busy}
                          onClick={deactivateTemplate}
                          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Deactivate Template
                        </Button>
                      ) : (
                        <Button
                          disabled={busy}
                          onClick={restoreTemplate}
                          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Restore Template
                        </Button>
                      )}
                    </div>
                  </div>

                  <TemplateRubricEditor
                    rubricItems={selectedTemplate.rubricItems || []}
                    busy={busy}
                    onAdd={addRubricItem}
                    onUpdate={updateRubricItem}
                    onRemove={removeRubricItem}
                  />
                </>
              ) : (
                <section className="surface p-5">
                  <p className="text-sm text-[var(--ink-subtle)]">Template not found.</p>
                </section>
              )}
            </section>
          )}
        </PageViewContent>
      </PageView>
    );
  }


  function upsertTemplate(template: PillarTemplateRecord) {
    setTemplates(current => {
      const next = current.filter(item => item.pillarType !== template.pillarType);
      next.push(template);
      return next.sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });
    });
    setSelectedType(template.pillarType);
  }

  async function createTemplate() {
    setError(null);
    setBusy(true);
    try {
      const created = await requestJson<PillarTemplateRecord>("/api/pillar-templates", {
        method: "POST",
        body: JSON.stringify({
          pillarType: createForm.pillarType,
          name: createForm.name,
          description: createForm.description || null,
          icon: createForm.icon || null,
          colorToken: createForm.colorToken || null,
          order: Number(createForm.order || "0"),
          isActive: createForm.isActive,
          rubricItems: []
        })
      });
      upsertTemplate(created);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create template.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!selectedTemplate || !editForm) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await requestJson<PillarTemplateRecord>(`/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          icon: editForm.icon || null,
          colorToken: editForm.colorToken || null,
          order: Number(editForm.order || "0"),
          isActive: editForm.isActive
        })
      });
      upsertTemplate(updated);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update template.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateTemplate() {
    if (!selectedTemplate) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await requestJson<PillarTemplateRecord>(`/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}`, {
        method: "DELETE"
      });
      upsertTemplate(updated);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to deactivate template.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreTemplate() {
    if (!selectedTemplate) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await requestJson<PillarTemplateRecord>(`/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}/restore`, {
        method: "POST"
      });
      upsertTemplate(updated);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Failed to restore template.");
    } finally {
      setBusy(false);
    }
  }

  async function addRubricItem(payload: {
    activityType: string;
    tier: string;
    label?: string;
    points: number;
    examples?: string;
  }) {
    if (!selectedTemplate) {
      return;
    }
    const updated = await requestJson<PillarTemplateRecord>(`/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}/rubric`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    upsertTemplate(updated);
  }

  async function updateRubricItem(rubricItemId: string, payload: { label?: string; points?: number }) {
    if (!selectedTemplate) {
      return;
    }
    const updated = await requestJson<PillarTemplateRecord>(
      `/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}/rubric/${encodeURIComponent(rubricItemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      }
    );
    upsertTemplate(updated);
  }

  async function removeRubricItem(rubricItemId: string) {
    if (!selectedTemplate) {
      return;
    }
    const updated = await requestJson<PillarTemplateRecord>(
      `/api/pillar-templates/${encodeURIComponent(selectedTemplate.pillarType)}/rubric/${encodeURIComponent(rubricItemId)}`,
      {
        method: "DELETE"
      }
    );
    upsertTemplate(updated);
  }

  return (
    <PageView>
      <PageViewHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pillar Templates</h1>
        </div>
        <div className="flex gap-2">
          <PrimaryButton
            buttonType="button"
            onClick={() => setShowCreate(current => !current)}
            className="inline-flex items-center"
          >
            New template
          </PrimaryButton>
        </div>
      </PageViewHeader>

      <PageViewContent>

      {error ? (
        <p className="mono mb-4 rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]">{error}</p>
      ) : null}

      {showCreate ? (
        <div className="mb-4">
          <PillarTemplateForm
            title="Create Template"
            value={createForm}
            submitLabel="Create Template"
            showTypeField
            busy={busy}
            onChange={setCreateForm}
            onSubmit={createTemplate}
          />
        </div>
      ) : null}

          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Section title={null}>
            {error ? (
              <div className="mb-4 space-y-2">
                <p className="mono rounded bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)]">{error}</p>
                <Button buttonType="button" onClick={loadTemplates} className="mono text-xs" disabled={loading}>
                  Retry
                </Button>
              </div>
            ) : null}
            {loading ? (
              <p className="text-sm text-[var(--ink-subtle)]">Loading...</p>
            ) : null}
            <ListGroup>
              {templates.map(template => (
                <ListItem
                  key={template.pillarType}
                  onClick={() => setSelectedType(template.pillarType)}
                  active={normalizeTemplateType(template.pillarType) === selectedTemplateType || normalizeTemplateType(template.pillarType) === activeTemplateType}
                  icon={getTemplateIcon(template.icon, { size: 14 })}
                  aria-label={`Open template ${template.name}`}
                >
                  {template.name}
                </ListItem>
              ))}
            </ListGroup>
          </Section>

        <section className="grid gap-4">
          {selectedTemplate && editForm ? (
            <>
              <PillarTemplateForm
                title={`Template: ${selectedTemplate.name}`}
                value={editForm}
                submitLabel="Save Template"
                busy={busy}
                onChange={setEditForm}
                onSubmit={saveTemplate}
              />

              <div className="surface p-4">
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.isActive ? (
                    <Button
                      disabled={busy}
                      onClick={deactivateTemplate}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Deactivate Template
                    </Button>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={restoreTemplate}
                      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Restore Template
                    </Button>
                  )}
                </div>
              </div>

              <TemplateRubricEditor
                rubricItems={selectedTemplate.rubricItems || []}
                busy={busy}
                onAdd={addRubricItem}
                onUpdate={updateRubricItem}
                onRemove={removeRubricItem}
              />
            </>
          ) : (
            <section className="surface p-5">
              <p className="text-sm text-[var(--ink-subtle)]">Select a template to edit metadata and rubric items.</p>
            </section>
          )}
        </section>
        </div>
      </PageViewContent>
    </PageView>
  );
}
