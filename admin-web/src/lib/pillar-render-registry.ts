const COLOR_RENDER_REGISTRY: Record<string, string> = Object.freeze({
  coral: "#FF6B6B",
  rose: "#E91E63",
  violet: "#9C27B0",
  indigo: "#5C7CFA",
  blue: "#2196F3",
  sky: "#4DABF7",
  mint: "#20C997",
  green: "#4CAF50",
  lime: "#AEEA00",
  amber: "#FFB300",
  orange: "#FF9800",
  slate: "#607D8B"
});

const FALLBACK_COLOR_TOKEN = "slate";

function normalizeToken(raw: string | null | undefined) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

export function resolveColorHexForToken(token: string | null | undefined) {
  const normalized = normalizeToken(token);
  if (normalized && COLOR_RENDER_REGISTRY[normalized]) {
    return COLOR_RENDER_REGISTRY[normalized];
  }
  return COLOR_RENDER_REGISTRY[FALLBACK_COLOR_TOKEN];
}

export function iconBadge(token: string | null | undefined) {
  const normalized = normalizeToken(token);
  if (!normalized) {
    return "??";
  }
  return normalized.slice(0, 2).toUpperCase();
}
