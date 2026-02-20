"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";

type Action = "step1" | "step2" | "step3";

type RunnerResponse = {
  ok: boolean;
  action: Action;
  requestedAt?: string;
  durationMs?: number;
  baseUrl?: string;
  date?: string;
  payload?: unknown;
  error?: string;
};

type StepResult = {
  action: Action;
  status: "idle" | "running" | "success" | "error";
  httpStatus?: number;
  data?: unknown;
  error?: string;
};

const API_KEY_STORAGE_KEY = "pillars_admin_api_key";
const DEFAULT_BASE_URL = "https://pillars-phi.vercel.app";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function jsonString(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function runStep({
  action,
  apiKey,
  baseUrl,
  date
}: {
  action: Action;
  apiKey: string;
  baseUrl: string;
  date: string;
}) {
  const response = await fetch("/api/agent-runner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      apiKey,
      baseUrl,
      date
    })
  });

  let body: RunnerResponse | null = null;
  try {
    body = (await response.json()) as RunnerResponse;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.ok) {
    const message = body?.error || (body?.payload && typeof body.payload === "object"
      ? jsonString(body.payload)
      : `HTTP ${response.status}`);
    throw new Error(message);
  }

  return {
    statusCode: response.status,
    body
  };
}

export function EndpointRunner() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [date, setDate] = useState(todayDateString());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<Action, StepResult>>({
    step1: { action: "step1", status: "idle" },
    step2: { action: "step2", status: "idle" },
    step3: { action: "step3", status: "idle" }
  });

  useEffect(() => {
    const savedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const hasApiKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  function saveApiKey() {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  }

  function clearApiKey() {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey("");
  }

  function setRunning(action: Action) {
    setResults(current => ({
      ...current,
      [action]: {
        ...current[action],
        status: "running",
        error: undefined
      }
    }));
  }

  function setSuccess(action: Action, statusCode: number, payload: unknown) {
    setResults(current => ({
      ...current,
      [action]: {
        action,
        status: "success",
        httpStatus: statusCode,
        data: payload
      }
    }));
  }

  function setError(action: Action, error: string) {
    setResults(current => ({
      ...current,
      [action]: {
        ...current[action],
        status: "error",
        error
      }
    }));
  }

  async function runOne(action: Action) {
    if (!hasApiKey) {
      setError(action, "Add an API key first.");
      return;
    }

    setBusy(true);
    setRunning(action);

    try {
      const response = await runStep({
        action,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        date
      });
      setSuccess(action, response.statusCode, response.body);
    } catch (error) {
      setError(action, error instanceof Error ? error.message : "Unknown run error");
    } finally {
      setBusy(false);
    }
  }

  async function runAll() {
    if (!hasApiKey) {
      setError("step1", "Add an API key first.");
      return;
    }

    const ordered: Action[] = ["step1", "step2", "step3"];
    setBusy(true);
    for (const action of ordered) {
      setRunning(action);
      try {
        const response = await runStep({
          action,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          date
        });
        setSuccess(action, response.statusCode, response.body);
      } catch (error) {
        setError(action, error instanceof Error ? error.message : "Unknown run error");
        break;
      }
    }
    setBusy(false);
  }

  return (
    <section className="surface mb-6 p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Step Flow Runner</h2>
        <p className="text-sm text-[var(--ink-subtle)]">
          Add your API key, then run Step 1/2/3 and inspect full endpoint responses.
        </p>
        <p className="mono text-xs text-[#b45309]">
          Step 3 writes data and uses <span className="font-semibold">mode=replace</span> on the selected date.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">API key</span>
          <input
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder="plr_..."
            type="password"
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">API base URL</span>
          <input
            value={baseUrl}
            onChange={event => setBaseUrl(event.target.value)}
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-subtle)]">Step 3 date</span>
          <input
            value={date}
            onChange={event => setDate(event.target.value)}
            type="date"
            className="mono w-full rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={saveApiKey}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:bg-[#f1f4ec]"
        >
          Save Key
        </Button>
        <Button
          onClick={clearApiKey}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:bg-[#f1f4ec]"
        >
          Clear Key
        </Button>
        <Button
          disabled={busy}
          onClick={() => runOne("step1")}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:bg-[#f1f4ec] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Step 1
        </Button>
        <Button
          disabled={busy}
          onClick={() => runOne("step2")}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:bg-[#f1f4ec] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Step 2
        </Button>
        <Button
          disabled={busy}
          onClick={() => runOne("step3")}
          className="mono cursor-pointer rounded-md border border-[var(--line-strong)] bg-[#fde68a] px-3 py-2 text-xs text-[#7c2d12] hover:bg-[#fcd34d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Step 3 (Write)
        </Button>
        <Button
          disabled={busy}
          onClick={runAll}
          className="mono cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)] hover:bg-[#bfe8d8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run All
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {(["step1", "step2", "step3"] as Action[]).map(action => {
          const result = results[action];
          const statusLabel = result.status === "idle"
            ? "idle"
            : result.status === "running"
              ? "running"
              : result.status === "success"
                ? `ok (${result.httpStatus})`
                : "error";

          return (
            <article key={action} className="rounded-md border border-[var(--line)] bg-white p-3">
              <header className="mb-2 flex items-center justify-between gap-2">
                <h3 className="mono text-xs uppercase tracking-wide">{action}</h3>
                <span className="mono rounded bg-[#eef2ea] px-2 py-1 text-xs text-[var(--ink-subtle)]">{statusLabel}</span>
              </header>
              {result.error ? (
                <p className="mono rounded bg-[#fff5f5] px-2 py-2 text-xs text-[#b91c1c]">{result.error}</p>
              ) : null}
              {result.data ? (
                <pre className="mono max-h-80 overflow-auto rounded bg-[#1f2621] p-3 text-xs text-[#d7f4df]">
                  {jsonString(result.data)}
                </pre>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
