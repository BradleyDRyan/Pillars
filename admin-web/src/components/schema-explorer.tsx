"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Accordion } from "@base-ui/react/accordion";
import { Button } from "@base-ui/react/button";
import { EndpointRunner } from "@/components/endpoint-runner";
import type {
  BlockTypeSchema,
  JsonObjectSchema,
  JsonSchemaProperty,
  SchemasResponse
} from "@/lib/schemas";

type Props = {
  data: SchemasResponse;
};

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function propertyMetaList(property: JsonSchemaProperty) {
  const entries: Array<[string, string]> = [];
  if (property.type) entries.push(["type", property.type]);
  if (property.min !== undefined) entries.push(["min", String(property.min)]);
  if (property.max !== undefined) entries.push(["max", String(property.max)]);
  if (property.minLength !== undefined) entries.push(["minLength", String(property.minLength)]);
  if (property.maxLength !== undefined) entries.push(["maxLength", String(property.maxLength)]);
  if (property.format) entries.push(["format", property.format]);
  if (property.nullable !== undefined) entries.push(["nullable", String(property.nullable)]);
  if (property.default !== undefined) entries.push(["default", String(property.default)]);
  if (property.enum && property.enum.length > 0) entries.push(["enum", property.enum.join(", ")]);
  return entries;
}

function JsonSchemaTable({
  schema,
  title
}: {
  schema: JsonObjectSchema;
  title: string;
}) {
  const rows = Object.entries(schema.properties);
  return (
    <section className="surface slide-up p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="mono rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--ink-subtle)]">
          required: {schema.required.length}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="border-b border-[var(--line)] py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-subtle)]">Field</th>
              <th className="border-b border-[var(--line)] py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-subtle)]">Required</th>
              <th className="border-b border-[var(--line)] py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-subtle)]">Rules</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([field, prop]) => (
              <tr key={field}>
                <td className="border-b border-[var(--line)] py-3 align-top">
                  <span className="mono rounded bg-white px-2 py-1 text-xs">{field}</span>
                </td>
                <td className="border-b border-[var(--line)] py-3 align-top">
                  {schema.required.includes(field) ? (
                    <span className="mono rounded bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">yes</span>
                  ) : (
                    <span className="mono rounded bg-[#ecefe9] px-2 py-1 text-xs text-[var(--ink-subtle)]">no</span>
                  )}
                </td>
                <td className="border-b border-[var(--line)] py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    {propertyMetaList(prop).map(([label, value]) => (
                      <span key={`${field}-${label}`} className="mono rounded bg-white px-2 py-1 text-xs text-[var(--ink-subtle)]">
                        {label}: {value}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BlockTypeCard({ blockType }: { blockType: BlockTypeSchema }) {
  const schemaText = prettyJson(blockType.dataSchema);
  return (
    <article className="surface p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">
            {blockType.name || blockType.id}
            <span className="mono ml-2 rounded bg-white px-2 py-1 text-xs text-[var(--ink-subtle)]">{blockType.id}</span>
          </h4>
          <p className="mt-1 text-sm text-[var(--ink-subtle)]">
            section: <span className="mono">{blockType.defaultSection}</span> · category:{" "}
            <span className="mono">{blockType.category}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--ink-subtle)]">
            subtitle: <span className="mono">{blockType.subtitleTemplate || "(none)"}</span>
          </p>
        </div>
        {blockType.color ? (
          <span
            className="h-8 w-8 rounded-full border border-[var(--line-strong)]"
            style={{ backgroundColor: blockType.color }}
            aria-label={blockType.color}
            title={blockType.color}
          />
        ) : null}
      </header>
      <Accordion.Root defaultValue={["schema"]}>
        <Accordion.Item value="schema" className="border-t border-[var(--line)] pt-3">
          <Accordion.Header>
            <Accordion.Trigger className="mono flex w-full cursor-pointer items-center justify-between rounded-md bg-white px-3 py-2 text-left text-xs">
              Expand data schema
              <span aria-hidden>+</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>
            <pre className="mono mt-2 max-h-64 overflow-auto rounded-md bg-[#1f2621] p-3 text-xs text-[#d7f4df]">{schemaText}</pre>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </article>
  );
}

function CopyButton({ value, label }: { value: unknown; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prettyJson(value));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button
      onClick={handleCopy}
      className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:bg-[#f1f4ec]"
    >
      {copied ? "Copied" : `Copy ${label}`}
    </Button>
  );
}

export function SchemaExplorer({ data }: Props) {
  const [query, setQuery] = useState("");

  const filteredBlockTypes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return data.blockTypes;
    }
    return data.blockTypes.filter((type) => {
      const haystack = `${type.id} ${type.name ?? ""} ${type.defaultSection}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data.blockTypes, query]);

  return (
    <main className="fade-in mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Pillars Schema Control Plane</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ink-subtle)] md:text-base">
          Canonical write contracts for Step 2 agents. This view is powered by <span className="mono">GET /api/schemas</span>.
        </p>
      </section>

      <EndpointRunner />

      <Tabs.Root defaultValue="blockTypes" className="surface p-4 md:p-6">
        <Tabs.List className="mb-5 flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
          {[
            ["blockTypes", "Block Types"],
            ["todo", "Todo Schema"],
            ["habit", "Habit Schema"],
            ["day", "Day Schema"],
            ["events", "Event Types"]
          ].map(([value, label]) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="mono cursor-pointer rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink)] data-[active]:border-[var(--accent)] data-[active]:bg-[var(--accent-soft)]"
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="blockTypes" className="slide-up">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex-1">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">Filter block types</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="sleep, feeling, custom..."
                className="w-full rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
            <CopyButton value={data.blockTypes} label="blockTypes" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredBlockTypes.map((blockType) => (
              <BlockTypeCard key={blockType.id} blockType={blockType} />
            ))}
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="todo" className="slide-up">
          <div className="mb-4 flex justify-end">
            <CopyButton value={data.todoSchema} label="todoSchema" />
          </div>
          <div className="grid gap-4">
            <JsonSchemaTable title="Todo Create" schema={data.todoSchema.create} />
            <JsonSchemaTable title="Todo Update" schema={data.todoSchema.update} />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="habit" className="slide-up">
          <div className="mb-4 flex justify-end">
            <CopyButton value={data.habitSchema} label="habitSchema" />
          </div>
          <div className="grid gap-4">
            <JsonSchemaTable title="Habit Create" schema={data.habitSchema.create} />
            <JsonSchemaTable title="Habit Update" schema={data.habitSchema.update} />
            <JsonSchemaTable title="Habit Log" schema={data.habitSchema.log} />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="day" className="slide-up">
          <div className="mb-4 flex justify-end">
            <CopyButton value={data.daySchema} label="daySchema" />
          </div>
          <article className="surface p-5">
            <h3 className="text-lg font-semibold">Day Batch Push Contract</h3>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">
              Contract used by <span className="mono">POST /api/days/:date/blocks/batch</span>
            </p>
            <pre className="mono mt-3 max-h-[460px] overflow-auto rounded-md bg-[#1f2621] p-4 text-xs text-[#d7f4df]">
              {prettyJson(data.daySchema)}
            </pre>
          </article>
        </Tabs.Panel>

        <Tabs.Panel value="events" className="slide-up">
          <div className="mb-4 flex justify-end">
            <CopyButton value={data.eventTypes} label="eventTypes" />
          </div>
          <article className="surface p-5">
            <h3 className="text-lg font-semibold">Event Types</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.eventTypes.map((eventType) => (
                <span key={eventType} className="mono rounded-md bg-white px-2.5 py-1.5 text-xs">
                  {eventType}
                </span>
              ))}
            </div>
          </article>
        </Tabs.Panel>
      </Tabs.Root>
    </main>
  );
}
