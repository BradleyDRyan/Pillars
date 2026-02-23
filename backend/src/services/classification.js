const { chatCompletion } = require('./openai');
const { logger } = require('../config/firebase');
const { getRubricItems } = require('../utils/rubrics');
const { parseFactsMarkdown } = require('../utils/userFactsMarkdown');

const CLASSIFICATION_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TEXT_LENGTH = 1200;
const AUTO_CLASSIFICATION_MAX_MATCHES = 3;
const USER_CONTEXT_MAX_FACT_LENGTH = 120;

function extractModelTextContent(responseMessage) {
  if (!responseMessage) {
    return '';
  }

  if (typeof responseMessage.content === 'string') {
    return responseMessage.content;
  }

  if (Array.isArray(responseMessage.content)) {
    return responseMessage.content
      .map(part => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function textPreview(value) {
  const normalized = normalizeClassificationText(value);
  if (!normalized) {
    return '';
  }
  return normalized.slice(0, 140);
}

function summarizeCandidate(candidate) {
  if (!candidate?.rubricItem) {
    return null;
  }
  return {
    pillarId: candidate.pillarId || null,
    pillarName: candidate.pillarName || null,
    rubricItemId: candidate.rubricItem.id || null,
    points: Number(candidate.rubricItem.points) || 0,
    label: candidate.rubricItem.label || null
  };
}

function summarizeCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    return [];
  }
  return candidates.map(summarizeCandidate).filter(Boolean);
}

function createClassificationError(message, status = 400, code = 'classification_error') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeClassificationText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return trimmed.slice(0, MAX_TEXT_LENGTH);
  }
  return trimmed;
}

function normalizeContextString(value, maxLength = USER_CONTEXT_MAX_FACT_LENGTH) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    return `${normalized.slice(0, maxLength)}...`;
  }
  return normalized;
}

function extractFactFromContainers(containers, keys) {
  for (const container of containers) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) {
      continue;
    }
    for (const key of keys) {
      const value = normalizeContextString(container[key]);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

function formatUserFactsForPrompt(userFacts) {
  if (!Array.isArray(userFacts) || !userFacts.length) {
    return null;
  }

  const lines = userFacts
    .map(item => normalizeContextString(item, USER_CONTEXT_MAX_FACT_LENGTH + 40))
    .filter(Boolean)
    .map(item => `- ${item}`);

  if (!lines.length) {
    return null;
  }
  return lines.join('\n');
}

function parseFactsValue(rawFacts, { maxFacts = 12, maxFactLength = USER_CONTEXT_MAX_FACT_LENGTH } = {}) {
  const fromMarkdown = parseFactsMarkdown(typeof rawFacts === 'string' ? rawFacts : null, {
    maxFacts,
    maxFactLength
  });
  if (fromMarkdown.length) {
    return fromMarkdown;
  }

  const list = Array.isArray(rawFacts)
    ? rawFacts
    : (typeof rawFacts === 'string' ? rawFacts.split(/\r?\n/) : []);

  if (!list.length) {
    return [];
  }

  const dedup = new Set();
  const normalized = [];
  for (const item of list) {
    if (typeof item !== 'string') {
      continue;
    }
    const value = normalizeContextString(item, maxFactLength);
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (dedup.has(key)) {
      continue;
    }
    dedup.add(key);
    normalized.push(value);
    if (normalized.length >= maxFacts) {
      break;
    }
  }

  return normalized;
}

function mergeFactLists(factLists, maxFacts = 12) {
  const dedup = new Set();
  const merged = [];
  for (const facts of factLists) {
    if (!Array.isArray(facts)) {
      continue;
    }
    for (const fact of facts) {
      if (typeof fact !== 'string') {
        continue;
      }
      const normalized = normalizeContextString(fact);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      merged.push(normalized);
      if (merged.length >= maxFacts) {
        return merged;
      }
    }
  }
  return merged;
}

async function loadUserContextFacts({ db, userId }) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return [];
    }
    const data = userDoc.data() || {};
    const directFacts = parseFactsValue(data.facts, {
      maxFacts: 12,
      maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH
    });
    const markdownFacts = parseFactsValue(data.factsMarkdown, {
      maxFacts: 12,
      maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH
    });
    const additionalData = data.additionalData && typeof data.additionalData === 'object' && !Array.isArray(data.additionalData)
      ? data.additionalData
      : null;
    const additionalFacts = parseFactsValue(additionalData?.facts, {
      maxFacts: 12,
      maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH
    });
    const additionalMarkdownFacts = parseFactsValue(additionalData?.factsMarkdown, {
      maxFacts: 12,
      maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH
    });
    const profile = data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)
      ? data.profile
      : null;
    const persona = data.persona && typeof data.persona === 'object' && !Array.isArray(data.persona)
      ? data.persona
      : null;

    const explicitFacts = mergeFactLists(
      [directFacts, markdownFacts, additionalFacts, additionalMarkdownFacts],
      12
    );
    if (explicitFacts.length) {
      return explicitFacts;
    }

    const containers = [data, profile, persona];

    const displayName = extractFactFromContainers(containers, ['displayName', 'fullName', 'name']);
    const spouseName = extractFactFromContainers(containers, [
      'spouseName',
      'partnerName',
      'wifeName',
      'husbandName',
      'spouse',
      'partner'
    ]);
    const occupation = extractFactFromContainers(containers, [
      'occupation',
      'jobTitle',
      'role',
      'profession',
      'career'
    ]);

    const facts = [];
    if (displayName) {
      facts.push(`User name: ${displayName}`);
    }
    if (spouseName) {
      facts.push(`Spouse or partner name: ${spouseName}`);
    }
    if (occupation) {
      facts.push(`Occupation or role: ${occupation}`);
    }
    return facts;
  } catch (error) {
    logger.warn(
      { userId, error: error?.message || String(error) },
      '[classification] Failed loading user context facts'
    );
    return [];
  }
}

function extractPillarContextFacts(pillarData) {
  if (!pillarData || typeof pillarData !== 'object') {
    return [];
  }
  const metadata = pillarData.metadata && typeof pillarData.metadata === 'object' && !Array.isArray(pillarData.metadata)
    ? pillarData.metadata
    : null;
  const settings = pillarData.settings && typeof pillarData.settings === 'object' && !Array.isArray(pillarData.settings)
    ? pillarData.settings
    : null;

  return mergeFactLists([
    parseFactsValue(pillarData.facts, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH }),
    parseFactsValue(pillarData.factsMarkdown, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH }),
    parseFactsValue(metadata?.facts, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH }),
    parseFactsValue(metadata?.factsMarkdown, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH }),
    parseFactsValue(settings?.facts, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH }),
    parseFactsValue(settings?.factsMarkdown, { maxFacts: 6, maxFactLength: USER_CONTEXT_MAX_FACT_LENGTH })
  ], 6);
}

function normalizeForMatch(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(value) {
  const normalized = normalizeForMatch(value);
  return normalized ? normalized.split(' ') : [];
}

function isExactPhraseMatch(text, phrase) {
  const normalizedText = normalizeForMatch(text);
  const normalizedPhrase = normalizeForMatch(phrase);
  if (!normalizedText || !normalizedPhrase) {
    return false;
  }
  return normalizedText.includes(normalizedPhrase);
}

function jsonCandidatesFromContent(content) {
  if (typeof content !== 'string' || !content.trim()) {
    return [];
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced?.[1]) {
    candidates.push(fenced[1]);
  }
  candidates.push(content);

  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0]);
  }

  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    candidates.push(arrayMatch[0]);
  }

  return candidates
    .map(value => value.trim())
    .filter(Boolean);
}

function parseModelClassification(content) {
  if (typeof content !== 'string' || !content.trim()) {
    return null;
  }

  for (const candidate of jsonCandidatesFromContent(content)) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        continue;
      }
      const rubricItemIdRaw = typeof parsed.rubric_item_id === 'string'
        ? parsed.rubric_item_id
        : (typeof parsed.rubricItemId === 'string' ? parsed.rubricItemId : '');
      const pillarIdRaw = typeof parsed.pillar_id === 'string'
        ? parsed.pillar_id
        : (typeof parsed.pillarId === 'string' ? parsed.pillarId : '');
      const rationaleRaw = typeof parsed.rationale === 'string'
        ? parsed.rationale
        : (typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : (typeof parsed.explanation === 'string' ? parsed.explanation : ''));
      const rubricItemId = rubricItemIdRaw.trim();
      const pillarId = pillarIdRaw.trim();
      const rationale = normalizeContextString(rationaleRaw, 700);
      if (!rubricItemId) {
        continue;
      }
      return {
        rubricItemId,
        pillarId: pillarId || null,
        rationale: rationale || null
      };
    } catch (_error) {
      // Try the next possible JSON candidate.
    }
  }

  return null;
}

function parseModelMultiClassification(content) {
  if (typeof content !== 'string' || !content.trim()) {
    return null;
  }

  for (const candidate of jsonCandidatesFromContent(content)) {
    try {
      const parsed = JSON.parse(candidate);
      let rawMatches = null;
      let rationaleRaw = '';
      if (Array.isArray(parsed)) {
        rawMatches = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rationaleRaw = typeof parsed.rationale === 'string'
          ? parsed.rationale
          : (typeof parsed.reasoning === 'string'
            ? parsed.reasoning
            : (typeof parsed.explanation === 'string' ? parsed.explanation : ''));
        if (Array.isArray(parsed.matches)) {
          rawMatches = parsed.matches;
        } else if (Array.isArray(parsed.items)) {
          rawMatches = parsed.items;
        } else if (Array.isArray(parsed.results)) {
          rawMatches = parsed.results;
        } else if (Array.isArray(parsed.classifications)) {
          rawMatches = parsed.classifications;
        } else if (parsed.rubric_item_id || parsed.rubricItemId) {
          rawMatches = [parsed];
        }
      }

      if (!Array.isArray(rawMatches)) {
        continue;
      }

      const normalized = rawMatches
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const rubricItemIdRaw = typeof item.rubric_item_id === 'string'
            ? item.rubric_item_id
            : (typeof item.rubricItemId === 'string' ? item.rubricItemId : '');
          const pillarIdRaw = typeof item.pillar_id === 'string'
            ? item.pillar_id
            : (typeof item.pillarId === 'string' ? item.pillarId : '');
          const rubricItemId = rubricItemIdRaw.trim();
          if (!rubricItemId) {
            return null;
          }
          const pillarId = pillarIdRaw.trim();
          return {
            rubricItemId,
            pillarId: pillarId || null
          };
        })
        .filter(Boolean);

      if (normalized.length > 0) {
        return {
          matches: normalized,
          rationale: normalizeContextString(rationaleRaw, 900) || null
        };
      }
    } catch (_error) {
      // Try next candidate.
    }
  }

  return null;
}

function rubricItemSortId(candidate) {
  const rubricId = typeof candidate?.rubricItem?.id === 'string' ? candidate.rubricItem.id : '';
  const pillarId = typeof candidate?.pillarId === 'string' ? candidate.pillarId : '';
  return `${rubricId}::${pillarId}`;
}

function rankByHeuristic(candidates, text) {
  const normalizedText = normalizeForMatch(text);
  const textTokens = new Set(tokenize(text));
  const scored = candidates.map(candidate => {
    const label = candidate.rubricItem?.label || '';
    const activityType = candidate.rubricItem?.activityType || '';
    const tier = candidate.rubricItem?.tier || '';
    const examples = candidate.rubricItem?.examples || '';

    let score = 0;
    if (isExactPhraseMatch(normalizedText, label)) {
      score += 12;
    }
    if (isExactPhraseMatch(normalizedText, activityType)) {
      score += 8;
    }
    if (isExactPhraseMatch(normalizedText, tier)) {
      score += 6;
    }
    if (isExactPhraseMatch(normalizedText, examples)) {
      score += 4;
    }

    const rubricTokens = new Set([
      ...tokenize(label),
      ...tokenize(activityType),
      ...tokenize(tier),
      ...tokenize(examples)
    ]);
    let overlap = 0;
    for (const token of textTokens) {
      if (rubricTokens.has(token)) {
        overlap += 1;
      }
    }
    const overlapContribution = Math.min(10, overlap);
    score += overlapContribution;

    return {
      candidate,
      score,
      overlap,
      points: Number.isFinite(candidate?.rubricItem?.points)
        ? Number(candidate.rubricItem.points)
        : 0
    };
  });

  return [...scored].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.overlap !== right.overlap) {
      return right.overlap - left.overlap;
    }
    if (left.points !== right.points) {
      return right.points - left.points;
    }
    const leftRubricId = left.candidate.rubricItem.id;
    const rightRubricId = right.candidate.rubricItem.id;
    if (leftRubricId !== rightRubricId) {
      return leftRubricId.localeCompare(rightRubricId);
    }
    return (left.candidate.pillarId || '').localeCompare(right.candidate.pillarId || '');
  });
}

function chooseByHeuristic(candidates, text) {
  const ranked = rankByHeuristic(candidates, text);
  if (!ranked.length) {
    return null;
  }

  const maxScore = ranked[0].score;
  if (maxScore === 0) {
    return [...ranked].sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }
      const leftRubricId = left.candidate.rubricItem.id;
      const rightRubricId = right.candidate.rubricItem.id;
      if (leftRubricId !== rightRubricId) {
        return leftRubricId.localeCompare(rightRubricId);
      }
      return (left.candidate.pillarId || '').localeCompare(right.candidate.pillarId || '');
    })[0]?.candidate || null;
  }

  return ranked[0].candidate;
}

function resolveCandidateFromModelSelection(candidates, parsedModel) {
  if (!parsedModel?.rubricItemId) {
    return null;
  }

  const matchingRubricId = candidates.filter(candidate => candidate.rubricItem.id === parsedModel.rubricItemId);
  if (!matchingRubricId.length) {
    return null;
  }

  if (matchingRubricId.length === 1) {
    return matchingRubricId[0];
  }

  if (parsedModel.pillarId) {
    const matchingPillar = matchingRubricId.find(candidate => candidate.pillarId === parsedModel.pillarId);
    if (matchingPillar) {
      return matchingPillar;
    }
  }

  return [...matchingRubricId].sort((left, right) => {
    const leftKey = rubricItemSortId(left);
    const rightKey = rubricItemSortId(right);
    return leftKey.localeCompare(rightKey);
  })[0];
}

function resolveCandidatesFromModelSelection(candidates, parsedModels, maxMatches) {
  if (!Array.isArray(parsedModels) || !parsedModels.length) {
    return [];
  }

  const dedup = new Set();
  const resolved = [];

  for (const parsedModel of parsedModels) {
    const candidate = resolveCandidateFromModelSelection(candidates, parsedModel);
    if (!candidate) {
      continue;
    }
    const key = `${candidate.pillarId}:${candidate.rubricItem.id}`;
    if (dedup.has(key)) {
      continue;
    }
    dedup.add(key);
    resolved.push(candidate);
    if (resolved.length >= maxMatches) {
      break;
    }
  }

  return resolved;
}

function formatCandidatesForPrompt(candidates, includePillar) {
  return candidates
    .map(candidate => {
      const rubricItem = candidate.rubricItem;
      const parts = [];
      if (includePillar) {
        parts.push(`pillar_id="${candidate.pillarId}"`);
        if (candidate.pillarName) {
          parts.push(`pillar_name="${candidate.pillarName}"`);
        }
      }
      parts.push(`rubric_item_id="${rubricItem.id}"`);
      parts.push(`label="${rubricItem.label || ''}"`);
      parts.push(`activity_type="${rubricItem.activityType || ''}"`);
      parts.push(`tier="${rubricItem.tier || ''}"`);
      parts.push(`points=${Number(rubricItem.points) || 0}`);
      if (rubricItem.examples) {
        parts.push(`examples="${rubricItem.examples}"`);
      }
      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

function formatPillarFactsForPrompt(candidates, includePillar) {
  if (!Array.isArray(candidates) || !candidates.length) {
    return null;
  }

  const byPillar = new Map();
  for (const candidate of candidates) {
    const pillarId = typeof candidate?.pillarId === 'string' ? candidate.pillarId : '';
    const facts = Array.isArray(candidate?.pillarFacts) ? candidate.pillarFacts : [];
    if (!pillarId || facts.length === 0) {
      continue;
    }
    if (!byPillar.has(pillarId)) {
      byPillar.set(pillarId, {
        pillarId,
        pillarName: normalizeContextString(candidate?.pillarName, 80),
        facts: mergeFactLists([facts], 6)
      });
    }
  }

  if (byPillar.size === 0) {
    return null;
  }

  const lines = [...byPillar.values()]
    .filter(entry => Array.isArray(entry.facts) && entry.facts.length > 0)
    .map(entry => {
      const parts = [];
      if (includePillar) {
        parts.push(`pillar_id="${entry.pillarId}"`);
        if (entry.pillarName) {
          parts.push(`pillar_name="${entry.pillarName}"`);
        }
      }
      parts.push(`facts="${entry.facts.join('; ')}"`);
      return `- ${parts.join(' | ')}`;
    });

  return lines.length ? lines.join('\n') : null;
}

async function selectCandidateWithModel({ text, candidates, includePillar, userFacts }) {
  const systemPrompt = [
    'You classify a user activity against an existing rubric.',
    'Pick exactly one rubric item from the provided options.',
    'Never invent ids, labels, points, or options.',
    'Respond with strict JSON only.',
    'Include a rationale string explaining why this is the best match.',
    includePillar
      ? 'If duplicate rubric_item_id values appear across pillars, include pillar_id too. Use: {"rubric_item_id":"<id>","pillar_id":"<pillarId>","rationale":"<reason>"}'
      : 'Use: {"rubric_item_id":"<id>","rationale":"<reason>"}'
  ].join('\n');

  const userContextBlock = formatUserFactsForPrompt(userFacts);
  const pillarFactsBlock = formatPillarFactsForPrompt(candidates, includePillar);
  const userPrompt = [
    `Activity text:\n${text}`,
    userContextBlock ? `\nUser context:\n${userContextBlock}` : null,
    pillarFactsBlock ? `\nPillar context:\n${pillarFactsBlock}` : null,
    '',
    'Rubric options:',
    formatCandidatesForPrompt(candidates, includePillar),
    '',
    'Return JSON now.'
  ]
    .filter(Boolean)
    .join('\n');

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    CLASSIFICATION_MODEL,
    {
      temperature: 0,
      max_tokens: 180
    }
  );

  const rawModelContent = extractModelTextContent(response);
  const parsed = parseModelClassification(rawModelContent);
  logger.info(
    {
      model: CLASSIFICATION_MODEL,
      includePillar,
      textPreview: textPreview(text),
      modelRequest: {
        systemPrompt,
        userPrompt
      },
      modelResponse: {
        raw: rawModelContent,
        parsed
      }
    },
    '[classification] Single model exchange'
  );

  return {
    candidate: resolveCandidateFromModelSelection(candidates, parsed),
    rationale: parsed?.rationale || null,
    modelSystemPrompt: systemPrompt,
    modelUserPrompt: userPrompt,
    modelResponseRaw: rawModelContent
  };
}

function buildClassificationResponse(candidate, {
  method,
  fallbackUsed,
  modelRationale = null,
  modelSystemPrompt = null,
  modelUserPrompt = null,
  modelResponseRaw = null
}) {
  return {
    pillarId: candidate.pillarId,
    rubricItem: candidate.rubricItem,
    bounty: candidate.rubricItem.points,
    method,
    modelUsed: CLASSIFICATION_MODEL,
    fallbackUsed,
    modelRationale,
    modelSystemPrompt,
    modelUserPrompt,
    modelResponseRaw
  };
}

function buildMultiClassificationResponse(candidates, {
  method,
  fallbackUsed,
  modelRationale = null,
  modelSystemPrompt = null,
  modelUserPrompt = null,
  modelResponseRaw = null
}) {
  return {
    matches: candidates.map((candidate, index) => ({
      rank: index + 1,
      pillarId: candidate.pillarId,
      rubricItem: candidate.rubricItem,
      bounty: candidate.rubricItem.points
    })),
    method,
    modelUsed: CLASSIFICATION_MODEL,
    fallbackUsed,
    modelRationale,
    modelSystemPrompt,
    modelUserPrompt,
    modelResponseRaw
  };
}

function toCandidate(pillarId, rubricItem, pillarName = null, pillarFacts = []) {
  return {
    pillarId,
    pillarName,
    pillarFacts,
    rubricItem
  };
}

function requireNonEmptyCandidates(candidates, message) {
  if (Array.isArray(candidates) && candidates.length > 0) {
    return;
  }
  throw createClassificationError(message, 409, 'empty_rubric');
}

async function getOwnedPillar({ db, userId, pillarId }) {
  const normalizedPillarId = typeof pillarId === 'string' ? pillarId.trim() : '';
  if (!normalizedPillarId) {
    throw createClassificationError('pillarId is required for auto-classification', 400, 'missing_pillar');
  }

  const pillarDoc = await db.collection('pillars').doc(normalizedPillarId).get();
  if (!pillarDoc.exists) {
    throw createClassificationError('Invalid pillarId', 400, 'invalid_pillar');
  }
  const pillarData = pillarDoc.data() || {};
  if (pillarData.userId !== userId) {
    throw createClassificationError('Invalid pillarId', 400, 'invalid_pillar');
  }

  return {
    pillarId: normalizedPillarId,
    pillarData
  };
}

async function runClassification({ text, candidates, includePillar, userFacts }) {
  const logContext = {
    model: CLASSIFICATION_MODEL,
    candidateCount: candidates.length,
    includePillar,
    userFactCount: Array.isArray(userFacts) ? userFacts.length : 0,
    textPreview: textPreview(text)
  };
  logger.info(logContext, '[classification] Single classification started');

  let aiRationale = null;
  let aiModelSystemPrompt = null;
  let aiModelUserPrompt = null;
  let aiModelResponseRaw = null;
  try {
    const aiResult = await selectCandidateWithModel({ text, candidates, includePillar, userFacts });
    aiRationale = aiResult?.rationale || null;
    aiModelSystemPrompt = aiResult?.modelSystemPrompt || null;
    aiModelUserPrompt = aiResult?.modelUserPrompt || null;
    aiModelResponseRaw = aiResult?.modelResponseRaw || null;
    if (aiResult?.candidate) {
      logger.info(
        {
          ...logContext,
          method: 'ai',
          modelRationale: aiRationale,
          match: summarizeCandidate(aiResult.candidate)
        },
        '[classification] Single classification resolved via AI'
      );
      return buildClassificationResponse(aiResult.candidate, {
        method: 'ai',
        fallbackUsed: false,
        modelRationale: aiRationale,
        modelSystemPrompt: aiModelSystemPrompt,
        modelUserPrompt: aiModelUserPrompt,
        modelResponseRaw: aiModelResponseRaw
      });
    }
    logger.warn(
      { ...logContext, reason: 'ai_returned_no_valid_match', modelRationale: aiRationale },
      '[classification] Single classification fell back to heuristic'
    );
  } catch (_error) {
    logger.warn(
      { ...logContext, error: _error?.message || String(_error) },
      '[classification] Single classification AI failed; using heuristic fallback'
    );
  }

  const heuristicChoice = chooseByHeuristic(candidates, text);
  if (!heuristicChoice) {
    logger.warn(logContext, '[classification] Single classification could not find rubric match');
    throw createClassificationError('Unable to classify activity', 409, 'no_rubric_match');
  }

  logger.info(
    {
      ...logContext,
      method: 'heuristic',
      match: summarizeCandidate(heuristicChoice)
    },
    '[classification] Single classification resolved via heuristic'
  );

  return buildClassificationResponse(heuristicChoice, {
    method: 'heuristic',
    fallbackUsed: true,
    modelRationale: aiRationale,
    modelSystemPrompt: aiModelSystemPrompt,
    modelUserPrompt: aiModelUserPrompt,
    modelResponseRaw: aiModelResponseRaw
  });
}

async function selectCandidatesWithModelMulti({ text, candidates, maxMatches, userFacts }) {
  const systemPrompt = [
    'You classify a user activity against an existing rubric.',
    `Pick up to ${maxMatches} best rubric matches.`,
    'Never invent ids, labels, points, or options.',
    'Return strict JSON only.',
    'Include a rationale string explaining why the matches were selected.',
    'Use this shape:',
    '{"matches":[{"rubric_item_id":"<id>","pillar_id":"<pillarId>"}],"rationale":"<reason>"}',
    'Do not include extra fields.'
  ].join('\n');

  const userContextBlock = formatUserFactsForPrompt(userFacts);
  const pillarFactsBlock = formatPillarFactsForPrompt(candidates, true);
  const userPrompt = [
    `Activity text:\n${text}`,
    userContextBlock ? `\nUser context:\n${userContextBlock}` : null,
    pillarFactsBlock ? `\nPillar context:\n${pillarFactsBlock}` : null,
    '',
    'Rubric options:',
    formatCandidatesForPrompt(candidates, true),
    '',
    'Return JSON now.'
  ]
    .filter(Boolean)
    .join('\n');

  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    CLASSIFICATION_MODEL,
    {
      temperature: 0,
      max_tokens: 320
    }
  );

  const rawModelContent = extractModelTextContent(response);
  const parsed = parseModelMultiClassification(rawModelContent);
  logger.info(
    {
      model: CLASSIFICATION_MODEL,
      maxMatches,
      textPreview: textPreview(text),
      modelRequest: {
        systemPrompt,
        userPrompt
      },
      modelResponse: {
        raw: rawModelContent,
        parsed
      }
    },
    '[classification] Multi model exchange'
  );

  return {
    candidates: resolveCandidatesFromModelSelection(candidates, parsed?.matches || [], maxMatches),
    rationale: parsed?.rationale || null,
    modelSystemPrompt: systemPrompt,
    modelUserPrompt: userPrompt,
    modelResponseRaw: rawModelContent
  };
}

async function runClassificationMulti({ text, candidates, maxMatches, userFacts }) {
  const normalizedMaxMatches = Number.isInteger(maxMatches)
    ? Math.max(1, Math.min(AUTO_CLASSIFICATION_MAX_MATCHES, maxMatches))
    : AUTO_CLASSIFICATION_MAX_MATCHES;
  const logContext = {
    model: CLASSIFICATION_MODEL,
    candidateCount: candidates.length,
    maxMatches: normalizedMaxMatches,
    userFactCount: Array.isArray(userFacts) ? userFacts.length : 0,
    textPreview: textPreview(text)
  };
  logger.info(logContext, '[classification] Multi classification started');

  let aiRationale = null;
  let aiModelSystemPrompt = null;
  let aiModelUserPrompt = null;
  let aiModelResponseRaw = null;
  try {
    const aiResult = await selectCandidatesWithModelMulti({
      text,
      candidates,
      maxMatches: normalizedMaxMatches,
      userFacts
    });
    aiRationale = aiResult?.rationale || null;
    aiModelSystemPrompt = aiResult?.modelSystemPrompt || null;
    aiModelUserPrompt = aiResult?.modelUserPrompt || null;
    aiModelResponseRaw = aiResult?.modelResponseRaw || null;
    if (aiResult?.candidates?.length > 0) {
      logger.info(
        {
          ...logContext,
          method: 'ai',
          modelRationale: aiRationale,
          matches: summarizeCandidates(aiResult.candidates)
        },
        '[classification] Multi classification resolved via AI'
      );
      return buildMultiClassificationResponse(aiResult.candidates, {
        method: 'ai',
        fallbackUsed: false,
        modelRationale: aiRationale,
        modelSystemPrompt: aiModelSystemPrompt,
        modelUserPrompt: aiModelUserPrompt,
        modelResponseRaw: aiModelResponseRaw
      });
    }
    logger.warn(
      { ...logContext, reason: 'ai_returned_no_valid_matches', modelRationale: aiRationale },
      '[classification] Multi classification fell back to heuristic'
    );
  } catch (_error) {
    logger.warn(
      { ...logContext, error: _error?.message || String(_error) },
      '[classification] Multi classification AI failed; using heuristic fallback'
    );
  }

  const ranked = rankByHeuristic(candidates, text);
  if (!ranked.length) {
    logger.warn(logContext, '[classification] Multi classification could not find rubric match');
    throw createClassificationError('Unable to classify activity', 409, 'no_rubric_match');
  }

  const selected = [ranked[0]];
  const topScore = ranked[0].score;

  for (const entry of ranked.slice(1)) {
    if (selected.length >= normalizedMaxMatches) {
      break;
    }
    if (entry.score <= 0) {
      break;
    }
    if (topScore > 0 && entry.score < topScore * 0.6) {
      break;
    }
    selected.push(entry);
  }

  logger.info(
    {
      ...logContext,
      method: 'heuristic',
      topScore: ranked[0]?.score || 0,
      matches: summarizeCandidates(selected.map(entry => entry.candidate))
    },
    '[classification] Multi classification resolved via heuristic'
  );

  return buildMultiClassificationResponse(
    selected.map(entry => entry.candidate),
    {
      method: 'heuristic',
      fallbackUsed: true,
      modelRationale: aiRationale,
      modelSystemPrompt: aiModelSystemPrompt,
      modelUserPrompt: aiModelUserPrompt,
      modelResponseRaw: aiModelResponseRaw
    }
  );
}

async function classifyAgainstRubric({ db, userId, text, pillarId }) {
  const normalizedText = normalizeClassificationText(text);
  if (!normalizedText) {
    throw createClassificationError('text is required for classification', 400, 'missing_text');
  }

  const pillar = await getOwnedPillar({ db, userId, pillarId });
  const userFacts = await loadUserContextFacts({ db, userId });
  const pillarName = normalizeContextString(pillar.pillarData?.name, 80);
  const pillarFacts = extractPillarContextFacts(pillar.pillarData);
  const candidates = getRubricItems(pillar.pillarData)
    .filter(item => item && typeof item.id === 'string')
    .map(item => toCandidate(pillar.pillarId, item, pillarName, pillarFacts));

  logger.info(
    {
      userId,
      pillarId: pillar.pillarId,
      rubricItemCount: candidates.length,
      textPreview: textPreview(normalizedText)
    },
    '[classification] Scoped rubric classification requested'
  );

  requireNonEmptyCandidates(
    candidates,
    'Pillar has no rubric items. Add rubric items before using auto-classification.'
  );

  return runClassification({
    text: normalizedText,
    candidates,
    includePillar: false,
    userFacts
  });
}

async function classifyAcrossPillars({ db, userId, text }) {
  const normalizedText = normalizeClassificationText(text);
  if (!normalizedText) {
    throw createClassificationError('text is required for classification', 400, 'missing_text');
  }

  const pillarsSnapshot = await db.collection('pillars')
    .where('userId', '==', userId)
    .get();
  const userFacts = await loadUserContextFacts({ db, userId });

  const candidates = [];
  for (const doc of pillarsSnapshot.docs) {
    const pillarData = doc.data() || {};
    const pillarName = normalizeContextString(pillarData?.name, 80);
    const pillarFacts = extractPillarContextFacts(pillarData);
    const rubricItems = getRubricItems(pillarData);
    for (const rubricItem of rubricItems) {
      if (!rubricItem || typeof rubricItem.id !== 'string') {
        continue;
      }
      candidates.push(toCandidate(doc.id, rubricItem, pillarName, pillarFacts));
    }
  }

  requireNonEmptyCandidates(
    candidates,
    'No rubric items found. Add rubric items to at least one pillar before using classification.'
  );

  logger.info(
    {
      userId,
      pillarCount: pillarsSnapshot.size,
      candidateCount: candidates.length,
      textPreview: textPreview(normalizedText)
    },
    '[classification] Global single-match classification requested'
  );

  return runClassification({
    text: normalizedText,
    candidates,
    includePillar: true,
    userFacts
  });
}

async function classifyAcrossPillarsMulti({ db, userId, text, maxMatches = AUTO_CLASSIFICATION_MAX_MATCHES }) {
  const normalizedText = normalizeClassificationText(text);
  if (!normalizedText) {
    throw createClassificationError('text is required for classification', 400, 'missing_text');
  }

  const pillarsSnapshot = await db.collection('pillars')
    .where('userId', '==', userId)
    .get();
  const userFacts = await loadUserContextFacts({ db, userId });

  const candidates = [];
  for (const doc of pillarsSnapshot.docs) {
    const pillarData = doc.data() || {};
    const pillarName = normalizeContextString(pillarData?.name, 80);
    const pillarFacts = extractPillarContextFacts(pillarData);
    const rubricItems = getRubricItems(pillarData);
    for (const rubricItem of rubricItems) {
      if (!rubricItem || typeof rubricItem.id !== 'string') {
        continue;
      }
      candidates.push(toCandidate(doc.id, rubricItem, pillarName, pillarFacts));
    }
  }

  requireNonEmptyCandidates(
    candidates,
    'No rubric items found. Add rubric items to at least one pillar before using classification.'
  );

  logger.info(
    {
      userId,
      pillarCount: pillarsSnapshot.size,
      candidateCount: candidates.length,
      maxMatches,
      textPreview: textPreview(normalizedText)
    },
    '[classification] Global multi-match classification requested'
  );

  return runClassificationMulti({
    text: normalizedText,
    candidates,
    maxMatches,
    userFacts
  });
}

module.exports = {
  createClassificationError,
  classifyAgainstRubric,
  classifyAcrossPillars,
  classifyAcrossPillarsMulti,
  rankByHeuristic
};
