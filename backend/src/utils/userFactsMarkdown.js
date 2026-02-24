const MAX_USER_CONTEXT_FACTS = 25;
const MAX_USER_CONTEXT_FACT_LENGTH = 200;

// Legacy aliases retained while clients migrate from "facts" naming.
const MAX_USER_FACTS = MAX_USER_CONTEXT_FACTS;
const MAX_USER_FACT_LENGTH = MAX_USER_CONTEXT_FACT_LENGTH;

function normalizeContextText(value, { maxLength = MAX_USER_CONTEXT_FACT_LENGTH } = {}) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
}

function stripMarkdownPrefix(line) {
  if (typeof line !== 'string') {
    return '';
  }

  return line
    .trim()
    .replace(/^[-*+]\s+\[[ xX]\]\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^#{1,6}\s+/, '');
}

function normalizeContextArray(rawContext, { maxFacts = MAX_USER_CONTEXT_FACTS, maxFactLength = MAX_USER_CONTEXT_FACT_LENGTH } = {}) {
  if (!Array.isArray(rawContext)) {
    return [];
  }

  const dedup = new Set();
  const normalized = [];

  for (const item of rawContext) {
    const value = normalizeContextText(stripMarkdownPrefix(item), { maxLength: maxFactLength });
    if (!value) {
      continue;
    }
    const dedupKey = value.toLowerCase();
    if (dedup.has(dedupKey)) {
      continue;
    }
    dedup.add(dedupKey);
    normalized.push(value);
    if (normalized.length >= maxFacts) {
      break;
    }
  }

  return normalized;
}

function parseContextMarkdown(markdown, { maxFacts = MAX_USER_CONTEXT_FACTS, maxFactLength = MAX_USER_CONTEXT_FACT_LENGTH } = {}) {
  if (typeof markdown !== 'string') {
    return [];
  }

  return normalizeContextArray(markdown.split(/\r?\n/), {
    maxFacts,
    maxFactLength
  });
}

function buildContextMarkdown(context) {
  if (!Array.isArray(context) || !context.length) {
    return null;
  }
  return context.join('\n');
}

function normalizeContextMarkdownPayload(
  { contextMarkdown, context, factsMarkdown, facts } = {},
  { maxFacts = MAX_USER_CONTEXT_FACTS, maxFactLength = MAX_USER_CONTEXT_FACT_LENGTH } = {}
) {
  const hasMarkdownInput = contextMarkdown !== undefined || factsMarkdown !== undefined;
  const hasListInput = context !== undefined || facts !== undefined;

  if (!hasMarkdownInput && !hasListInput) {
    return { provided: false };
  }

  const effectiveMarkdown = contextMarkdown !== undefined ? contextMarkdown : factsMarkdown;
  const effectiveList = context !== undefined ? context : facts;

  if (effectiveMarkdown === null || effectiveList === null) {
    return {
      provided: true,
      context: [],
      facts: [],
      markdown: null
    };
  }

  let normalizedContext;

  if (effectiveMarkdown !== undefined) {
    if (typeof effectiveMarkdown !== 'string') {
      return { error: 'contextMarkdown must be a string' };
    }
    const trimmedMarkdown = effectiveMarkdown.trim();
    normalizedContext = parseContextMarkdown(trimmedMarkdown, {
      maxFacts,
      maxFactLength
    });
    return {
      provided: true,
      context: normalizedContext,
      facts: normalizedContext,
      markdown: trimmedMarkdown || null
    };
  } else {
    const rawList = Array.isArray(effectiveList)
      ? effectiveList
      : (typeof effectiveList === 'string' ? effectiveList.split(/\r?\n/) : null);

    if (!rawList) {
      return { error: 'context must be a string or array of strings' };
    }

    if (rawList.some(item => typeof item !== 'string')) {
      return { error: 'context must contain only strings' };
    }

    normalizedContext = normalizeContextArray(rawList, {
      maxFacts,
      maxFactLength
    });
  }

  return {
    provided: true,
    context: normalizedContext,
    facts: normalizedContext,
    markdown: buildContextMarkdown(normalizedContext)
  };
}

// Backwards-compatible exports for existing imports.
const normalizeFactText = normalizeContextText;
const parseFactsMarkdown = parseContextMarkdown;
const buildFactsMarkdown = buildContextMarkdown;
const normalizeFactsMarkdownPayload = normalizeContextMarkdownPayload;

module.exports = {
  MAX_USER_CONTEXT_FACTS,
  MAX_USER_CONTEXT_FACT_LENGTH,
  MAX_USER_FACTS,
  MAX_USER_FACT_LENGTH,
  normalizeContextText,
  normalizeFactText,
  parseContextMarkdown,
  parseFactsMarkdown,
  buildContextMarkdown,
  buildFactsMarkdown,
  normalizeContextMarkdownPayload,
  normalizeFactsMarkdownPayload
};
