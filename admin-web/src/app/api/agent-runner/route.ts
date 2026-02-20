import { NextResponse } from "next/server";

type RunnerAction = "step1" | "step2" | "step3";

type RunnerRequestBody = {
  action?: RunnerAction;
  apiKey?: string;
  baseUrl?: string;
  date?: string;
};

type RemoteResponse = {
  ok: boolean;
  status: number;
  url: string;
  body: unknown;
  durationMs: number;
};

const DEFAULT_BASE_URL = "https://pillars-phi.vercel.app";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeBaseUrl(raw: unknown) {
  const input = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("baseUrl must be a valid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("baseUrl must use http or https");
  }

  return parsed.toString().replace(/\/+$/, "");
}

async function fetchRemoteJson(url: string, init: RequestInit = {}): Promise<RemoteResponse> {
  const startedAt = Date.now();
  const response = await fetch(url, {
    ...init,
    cache: "no-store"
  });
  const durationMs = Date.now() - startedAt;
  const text = await response.text();

  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    body,
    durationMs
  };
}

function buildAuthHeaders(apiKey: string) {
  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json"
  };
}

function summarizeContextPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const asObject = payload as Record<string, unknown>;
  const days = Array.isArray(asObject.days) ? asObject.days : [];
  const today = days.find(day => {
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      return false;
    }
    const dayDate = (day as { date?: unknown }).date;
    return typeof dayDate === "string" && dayDate === todayDateString();
  });

  const fallbackDay = today || days[0];
  const sections = fallbackDay && typeof fallbackDay === "object" && !Array.isArray(fallbackDay)
    ? ((fallbackDay as { sections?: unknown }).sections)
    : null;
  const flattened = fallbackDay && typeof fallbackDay === "object" && !Array.isArray(fallbackDay)
    ? ((fallbackDay as { flattenedBlocks?: unknown }).flattenedBlocks)
    : null;

  return {
    topLevelKeys: Object.keys(asObject),
    daysCount: days.length,
    hasToday: Boolean(today),
    sectionCount: Array.isArray(sections) ? sections.length : null,
    flattenedBlocksCount: Array.isArray(flattened) ? flattened.length : null
  };
}

function summarizeSchemasPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const asObject = payload as Record<string, unknown>;
  return {
    keys: Object.keys(asObject),
    blockTypesCount: Array.isArray(asObject.blockTypes) ? asObject.blockTypes.length : null,
    hasTodoSchema: Boolean(asObject.todoSchema),
    hasHabitSchema: Boolean(asObject.habitSchema),
    hasDaySchema: Boolean(asObject.daySchema),
    eventTypesCount: Array.isArray(asObject.eventTypes) ? asObject.eventTypes.length : null
  };
}

async function runStep1(baseUrl: string, apiKey: string) {
  const url = `${baseUrl}/api/context?days=7&include=todos,habits,pillars,principles&resolve=true`;
  const response = await fetchRemoteJson(url, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });

  return {
    ok: response.ok,
    step: 1,
    endpoint: "/api/context",
    response,
    summary: summarizeContextPayload(response.body)
  };
}

async function runStep2(baseUrl: string, apiKey: string) {
  const url = `${baseUrl}/api/schemas`;
  const response = await fetchRemoteJson(url, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });

  return {
    ok: response.ok,
    step: 2,
    endpoint: "/api/schemas",
    response,
    summary: summarizeSchemasPayload(response.body)
  };
}

async function runStep3(baseUrl: string, apiKey: string, date: string) {
  const authHeaders = buildAuthHeaders(apiKey);
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");

  const todoOne = await fetchRemoteJson(`${baseUrl}/api/todos`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      content: `Take car to the shop (${suffix})`,
      sectionId: "afternoon",
      status: "active",
      source: "clawdbot"
    })
  });
  if (!todoOne.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/days/${date}/blocks/batch`,
      failedAt: "todo-1",
      responses: { todoOne }
    };
  }

  const todoTwo = await fetchRemoteJson(`${baseUrl}/api/todos`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      content: `Call contractor (${suffix})`,
      sectionId: "afternoon",
      status: "active",
      source: "clawdbot"
    })
  });
  if (!todoTwo.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/days/${date}/blocks/batch`,
      failedAt: "todo-2",
      responses: { todoOne, todoTwo }
    };
  }

  const habit = await fetchRemoteJson(`${baseUrl}/api/habits`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `Morning Walk (${suffix})`,
      sectionId: "morning",
      schedule: { type: "daily", daysOfWeek: [] },
      target: { type: "binary", value: 1, unit: null },
      source: "clawdbot"
    })
  });
  if (!habit.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/days/${date}/blocks/batch`,
      failedAt: "habit",
      responses: { todoOne, todoTwo, habit }
    };
  }

  const todoOneBody = (todoOne.body && typeof todoOne.body === "object") ? (todoOne.body as Record<string, unknown>) : {};
  const todoTwoBody = (todoTwo.body && typeof todoTwo.body === "object") ? (todoTwo.body as Record<string, unknown>) : {};
  const habitBody = (habit.body && typeof habit.body === "object") ? (habit.body as Record<string, unknown>) : {};
  const todoOnePayload = (todoOneBody.todo && typeof todoOneBody.todo === "object")
    ? (todoOneBody.todo as Record<string, unknown>)
    : todoOneBody;
  const todoTwoPayload = (todoTwoBody.todo && typeof todoTwoBody.todo === "object")
    ? (todoTwoBody.todo as Record<string, unknown>)
    : todoTwoBody;

  const batch = await fetchRemoteJson(`${baseUrl}/api/days/${date}/blocks/batch`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      mode: "replace",
      blocks: [
        {
          typeId: "sleep",
          sectionId: "morning",
          order: 0,
          subtitle: "Great recovery — 92%. Push hard today.",
          source: "clawdbot",
          data: { score: 92, durationHours: 7.8, source: "whoop" }
        },
        {
          typeId: "feeling",
          sectionId: "morning",
          order: 1,
          source: "template",
          data: { energy: 8, mood: 8, stress: 3 }
        },
        {
          typeId: "habits",
          sectionId: "morning",
          order: 2,
          source: "clawdbot",
          data: {
            habitId: typeof habitBody.id === "string" ? habitBody.id : "missing-habit-id",
            name: typeof habitBody.name === "string" ? habitBody.name : "Morning Walk",
            completed: false,
            status: "pending"
          }
        },
        {
          typeId: "workout",
          sectionId: "afternoon",
          order: 0,
          subtitle: "Recovery is high — good day for strength",
          source: "clawdbot",
          data: { type: "Strength", duration: "45 min" }
        },
        {
          typeId: "todo",
          sectionId: "afternoon",
          order: 1,
          source: "clawdbot",
          data: {
            todoId: typeof todoOnePayload.id === "string" ? todoOnePayload.id : "missing-todo-id-1",
            title: typeof todoOnePayload.content === "string" ? todoOnePayload.content : "Take car to the shop",
            status: "active"
          }
        },
        {
          typeId: "todo",
          sectionId: "afternoon",
          order: 2,
          source: "clawdbot",
          data: {
            todoId: typeof todoTwoPayload.id === "string" ? todoTwoPayload.id : "missing-todo-id-2",
            title: typeof todoTwoPayload.content === "string" ? todoTwoPayload.content : "Call contractor",
            status: "active"
          }
        },
        {
          typeId: "reflection",
          sectionId: "evening",
          order: 0,
          source: "template",
          data: {}
        }
      ]
    })
  });

  return {
    ok: todoOne.ok && todoTwo.ok && habit.ok && batch.ok,
    step: 3,
    endpoint: `/api/days/${date}/blocks/batch`,
    responses: {
      todoOne,
      todoTwo,
      habit,
      batch
    },
      summary: {
        createdTodoIds: [
        typeof todoOnePayload.id === "string" ? todoOnePayload.id : null,
        typeof todoTwoPayload.id === "string" ? todoTwoPayload.id : null
        ],
        createdHabitId: typeof habitBody.id === "string" ? habitBody.id : null,
        batchStatus: batch.status
    }
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunnerRequestBody;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const action = body.action;
    if (action !== "step1" && action !== "step2" && action !== "step3") {
      return NextResponse.json({ error: "action must be one of: step1, step2, step3" }, { status: 400 });
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }

    const baseUrl = normalizeBaseUrl(body.baseUrl);
    const date = typeof body.date === "string" && body.date.trim() ? body.date.trim() : todayDateString();
    if (!isValidDateString(date)) {
      return NextResponse.json({ error: "date must use YYYY-MM-DD format" }, { status: 400 });
    }

    const startedAt = Date.now();
    let payload: unknown;

    if (action === "step1") {
      payload = await runStep1(baseUrl, apiKey);
    } else if (action === "step2") {
      payload = await runStep2(baseUrl, apiKey);
    } else {
      payload = await runStep3(baseUrl, apiKey, date);
    }

    const ok = Boolean(payload && typeof payload === "object" && (payload as { ok?: unknown }).ok === true);
    return NextResponse.json({
      ok,
      action,
      requestedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      baseUrl,
      date,
      payload
    }, { status: ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown runner error"
    }, { status: 500 });
  }
}
