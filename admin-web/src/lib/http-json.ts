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

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const bodyText = await response.text();
  let parsed: unknown = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
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

  return parsed as T;
}
