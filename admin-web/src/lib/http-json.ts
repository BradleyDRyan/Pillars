function truncate(text: string, max = 220) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}...`;
}

function normalizeBodyError(bodyText: string, parsed: unknown) {
  const payload = parsed as { error?: unknown; message?: unknown } | null;
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  const normalized = bodyText
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return null;
  }
  return truncate(normalized);
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfter: string | null, attempt: number): number {
  if (!retryAfter) {
    return Math.min(1000 * 2 ** attempt, 3000);
  }

  const parsed = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed * 1000, 3000);
  }

  const parsedDate = Date.parse(retryAfter);
  if (Number.isFinite(parsedDate)) {
    const deltaMs = parsedDate - Date.now();
    if (deltaMs > 0) {
      return Math.min(deltaMs, 3000);
    }
  }

  return Math.min(1000 * 2 ** attempt, 3000);
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const maxRetries = 3;
  const retryAllowed = method === "GET" || method === "HEAD";
  const requestTimeoutMs = 8000;

  let attempt = 0;
  let response: Response | null = null;
  let bodyText = "";
  let parsed: unknown = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const fetchSignal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    if (init?.signal) {
      init.signal.addEventListener("abort", () => controller.abort());
    }

    const requestInit: RequestInit = { ...(init || {}) };
    delete requestInit.signal;

    try {
      response = await fetch(url, {
        ...requestInit,
        signal: fetchSignal,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {})
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`${method} ${url} failed (request timed out after ${requestTimeoutMs}ms)`);
      }
      throw error;
    }
    clearTimeout(timeout);

    bodyText = await response.text();
    parsed = null;
    if (bodyText) {
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = null;
      }
    }

    if (response.ok) {
      return parsed as T;
    }

    const status = response.status;
    if (!retryAllowed || status !== 429 || attempt >= maxRetries) {
      break;
    }

    const retryAfter = response.headers.get("Retry-After");
    const delayMs = parseRetryAfterMs(retryAfter, attempt);
    attempt += 1;
    await sleep(delayMs);
  }

  const messageParts = [`${method} ${url} failed (${response.status} ${response.statusText})`];
  const serverMessage = normalizeBodyError(bodyText, parsed);
  if (serverMessage) {
    messageParts.push(`- ${serverMessage}`);
  }
  if (response.status === 404) {
    messageParts.push("- Route not found. Confirm this admin API route is deployed.");
  }
  throw new Error(messageParts.join(" "));
}
