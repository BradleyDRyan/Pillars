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
    hasActionSchema: Boolean(asObject.actionSchema),
    hasActionTemplateSchema: Boolean(asObject.actionTemplateSchema),
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

  const actionOne = await fetchRemoteJson(`${baseUrl}/api/actions`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: `Take car to the shop (${suffix})`,
      sectionId: "afternoon",
      targetDate: date,
      source: "clawdbot"
    })
  });
  if (!actionOne.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/actions`,
      failedAt: "action-1",
      responses: { actionOne }
    };
  }

  const actionTwo = await fetchRemoteJson(`${baseUrl}/api/actions`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: `Call contractor (${suffix})`,
      sectionId: "afternoon",
      targetDate: date,
      source: "clawdbot"
    })
  });
  if (!actionTwo.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/actions`,
      failedAt: "action-2",
      responses: { actionOne, actionTwo }
    };
  }

  const actionTemplate = await fetchRemoteJson(`${baseUrl}/api/action-templates`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: `Morning Walk (${suffix})`,
      cadence: { type: "daily", daysOfWeek: [] },
      defaultSectionId: "morning",
      defaultOrder: 0
    })
  });
  if (!actionTemplate.ok) {
    return {
      ok: false,
      step: 3,
      endpoint: `/api/action-templates`,
      failedAt: "action-template",
      responses: { actionOne, actionTwo, actionTemplate }
    };
  }

  const byDate = await fetchRemoteJson(`${baseUrl}/api/actions/by-date/${date}?ensure=true`, {
    method: "GET",
    headers: authHeaders
  });

  const actionOneBody = (actionOne.body && typeof actionOne.body === "object") ? (actionOne.body as Record<string, unknown>) : {};
  const actionTwoBody = (actionTwo.body && typeof actionTwo.body === "object") ? (actionTwo.body as Record<string, unknown>) : {};
  const actionTemplateBody = (actionTemplate.body && typeof actionTemplate.body === "object")
    ? (actionTemplate.body as Record<string, unknown>)
    : {};
  const byDateBody = (byDate.body && typeof byDate.body === "object") ? (byDate.body as Record<string, unknown>) : {};

  const actionOnePayload = (actionOneBody.action && typeof actionOneBody.action === "object")
    ? (actionOneBody.action as Record<string, unknown>)
    : actionOneBody;
  const actionTwoPayload = (actionTwoBody.action && typeof actionTwoBody.action === "object")
    ? (actionTwoBody.action as Record<string, unknown>)
    : actionTwoBody;
  const actionTemplatePayload = (actionTemplateBody.actionTemplate && typeof actionTemplateBody.actionTemplate === "object")
    ? (actionTemplateBody.actionTemplate as Record<string, unknown>)
    : actionTemplateBody;

  return {
    ok: actionOne.ok && actionTwo.ok && actionTemplate.ok && byDate.ok,
    step: 3,
    endpoint: `/api/actions/by-date/${date}?ensure=true`,
    responses: {
      actionOne,
      actionTwo,
      actionTemplate,
      byDate
    },
    summary: {
      createdActionIds: [
        typeof actionOnePayload.id === "string" ? actionOnePayload.id : null,
        typeof actionTwoPayload.id === "string" ? actionTwoPayload.id : null
      ],
      createdActionTemplateId: typeof actionTemplatePayload.id === "string" ? actionTemplatePayload.id : null,
      byDateCount: typeof byDateBody.count === "number" ? byDateBody.count : null,
      ensuredCreatedCount: typeof byDateBody.ensuredCreatedCount === "number" ? byDateBody.ensuredCreatedCount : null
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
