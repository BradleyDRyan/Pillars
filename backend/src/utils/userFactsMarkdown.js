const MAX_USER_FACTS = 25;
const MAX_USER_FACT_LENGTH = 200;

function normalizeFactText(value, { maxLength = MAX_USER_FACT_LENGTH } = {}) {
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

function normalizeFactsArray(rawFacts, { maxFacts = MAX_USER_FACTS, maxFactLength = MAX_USER_FACT_LENGTH } = {}) {
  if (!Array.isArray(rawFacts)) {
    return [];
  }

  const dedup = new Set();
  const normalized = [];

  for (const item of rawFacts) {
    const value = normalizeFactText(stripMarkdownPrefix(item), { maxLength: maxFactLength });
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

function parseFactsMarkdown(markdown, { maxFacts = MAX_USER_FACTS, maxFactLength = MAX_USER_FACT_LENGTH } = {}) {
  if (typeof markdown !== 'string') {
    return [];
  }

  return normalizeFactsArray(markdown.split(/\r?\n/), {
    maxFacts,
    maxFactLength
  });
}

function buildFactsMarkdown(facts) {
  if (!Array.isArray(facts) || !facts.length) {
    return null;
  }
  return facts.map(fact => `- ${fact}`).join('\n');
}

function normalizeFactsMarkdownPayload(
  { factsMarkdown, facts } = {},
  { maxFacts = MAX_USER_FACTS, maxFactLength = MAX_USER_FACT_LENGTH } = {}
) {
  if (factsMarkdown === undefined && facts === undefined) {
    return { provided: false };
  }

  if (factsMarkdown === null || facts === null) {
    return {
      provided: true,
      facts: [],
      markdown: null
    };
  }

  let normalizedFacts;

  if (factsMarkdown !== undefined) {
    if (typeof factsMarkdown !== 'string') {
      return { error: 'factsMarkdown must be a string' };
    }
    normalizedFacts = parseFactsMarkdown(factsMarkdown, {
      maxFacts,
      maxFactLength
    });
  } else {
    const rawList = Array.isArray(facts)
      ? facts
      : (typeof facts === 'string' ? facts.split(/\r?\n/) : null);

    if (!rawList) {
      return { error: 'facts must be a string or array of strings' };
    }

    if (rawList.some(item => typeof item !== 'string')) {
      return { error: 'facts must contain only strings' };
    }

    normalizedFacts = normalizeFactsArray(rawList, {
      maxFacts,
      maxFactLength
    });
  }

  return {
    provided: true,
    facts: normalizedFacts,
    markdown: buildFactsMarkdown(normalizedFacts)
  };
}

module.exports = {
  MAX_USER_FACTS,
  MAX_USER_FACT_LENGTH,
  normalizeFactText,
  parseFactsMarkdown,
  buildFactsMarkdown,
  normalizeFactsMarkdownPayload
};
