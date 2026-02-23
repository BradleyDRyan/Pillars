import { NextResponse } from "next/server";

const DEFAULT_API_BASE = "https://pillars-phi.vercel.app";

function getApiBaseUrl() {
  const fromEnv = process.env.PILLARS_API_BASE_URL?.trim();
  if (!fromEnv) {
    return DEFAULT_API_BASE;
  }
  return fromEnv.replace(/\/+$/, "");
}

type AuthMode = "read" | "write";

function resolveHeaders(mode: AuthMode, contentType = true) {
  const apiKey = process.env.PILLARS_API_KEY?.trim();
  const internalSecret = process.env.PILLARS_INTERNAL_SERVICE_SECRET?.trim();
  const userId = process.env.PILLARS_USER_ID?.trim();

  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  if (mode === "write") {
    if (internalSecret) {
      headers.Authorization = `Bearer ${internalSecret}`;
      if (userId) {
        headers["x-user-id"] = userId;
      }
      return headers;
    }
    throw new Error("Set PILLARS_INTERNAL_SERVICE_SECRET for admin write routes.");
  }

  if (apiKey) {
    headers["x-api-key"] = apiKey;
    return headers;
  }
  if (internalSecret && userId) {
    headers.Authorization = `Bearer ${internalSecret}`;
    headers["x-user-id"] = userId;
    return headers;
  }

  throw new Error("Set PILLARS_API_KEY or (PILLARS_INTERNAL_SERVICE_SECRET + PILLARS_USER_ID).");
}

function buildUrl(path: string, query?: string) {
  const baseUrl = getApiBaseUrl();
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${trimmedPath}${query || ""}`;
}

export async function proxyBackendJson({
  path,
  method = "GET",
  mode,
  body,
  query
}: {
  path: string;
  method?: string;
  mode: AuthMode;
  body?: unknown;
  query?: string;
}) {
  const url = buildUrl(path, query);
  const headers = resolveHeaders(mode, method !== "GET");

  const response = await fetch(url, {
    method,
    headers,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload: unknown = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return NextResponse.json(payload, {
    status: response.status
  });
}
