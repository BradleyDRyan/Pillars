const { chatCompletion } = require('./anthropic');
const { getRubricItems } = require('../utils/rubrics');

const CLASSIFICATION_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const MAX_TEXT_LENGTH = 1200;
const AUTO_CLASSIFICATION_MAX_MATCHES = 3;

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
      const rubricItemId = rubricItemIdRaw.trim();
      const pillarId = pillarIdRaw.trim();
      if (!rubricItemId) {
        continue;
      }
      return {
        rubricItemId,
        pillarId: pillarId || null
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
      if (Array.isArray(parsed)) {
        rawMatches = parsed;
      } else if (parsed && typeof parsed === 'object') {
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
        return normalized;
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

async function selectCandidateWithModel({ text, candidates, includePillar }) {
  const systemPrompt = [
    'You classify a user activity against an existing rubric.',
    'Pick exactly one rubric item from the provided options.',
    'Never invent ids, labels, points, or options.',
    'Respond with strict JSON only: {"rubric_item_id":"<id>"}',
    includePillar
      ? 'If duplicate rubric_item_id values appear across pillars, include pillar_id too: {"rubric_item_id":"<id>","pillar_id":"<pillarId>"}'
      : 'Do not include any extra fields.'
  ].join('\n');

  const userPrompt = [
    `Activity text:\n${text}`,
    '',
    'Rubric options:',
    formatCandidatesForPrompt(candidates, includePillar),
    '',
    'Return JSON now.'
  ].join('\n');

  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], {
    model: CLASSIFICATION_MODEL,
    temperature: 0,
    maxTokens: 180
  });

  const parsed = parseModelClassification(response?.content || '');
  return resolveCandidateFromModelSelection(candidates, parsed);
}

function buildClassificationResponse(candidate, { method, fallbackUsed }) {
  return {
    pillarId: candidate.pillarId,
    rubricItem: candidate.rubricItem,
    bounty: candidate.rubricItem.points,
    method,
    modelUsed: CLASSIFICATION_MODEL,
    fallbackUsed
  };
}

function buildMultiClassificationResponse(candidates, { method, fallbackUsed }) {
  return {
    matches: candidates.map((candidate, index) => ({
      rank: index + 1,
      pillarId: candidate.pillarId,
      rubricItem: candidate.rubricItem,
      bounty: candidate.rubricItem.points
    })),
    method,
    modelUsed: CLASSIFICATION_MODEL,
    fallbackUsed
  };
}

function toCandidate(pillarId, rubricItem) {
  return {
    pillarId,
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

async function runClassification({ text, candidates, includePillar }) {
  try {
    const aiChoice = await selectCandidateWithModel({ text, candidates, includePillar });
    if (aiChoice) {
      return buildClassificationResponse(aiChoice, {
        method: 'ai',
        fallbackUsed: false
      });
    }
  } catch (_error) {
    // Explicitly fallback to deterministic ranking if AI is unavailable or fails.
  }

  const heuristicChoice = chooseByHeuristic(candidates, text);
  if (!heuristicChoice) {
    throw createClassificationError('Unable to classify activity', 409, 'no_rubric_match');
  }

  return buildClassificationResponse(heuristicChoice, {
    method: 'heuristic',
    fallbackUsed: true
  });
}

async function selectCandidatesWithModelMulti({ text, candidates, maxMatches }) {
  const systemPrompt = [
    'You classify a user activity against an existing rubric.',
    `Pick up to ${maxMatches} best rubric matches.`,
    'Never invent ids, labels, points, or options.',
    'Return strict JSON only using this shape:',
    '{"matches":[{"rubric_item_id":"<id>","pillar_id":"<pillarId>"}]}',
    'Do not include extra fields.'
  ].join('\n');

  const userPrompt = [
    `Activity text:\n${text}`,
    '',
    'Rubric options:',
    formatCandidatesForPrompt(candidates, true),
    '',
    'Return JSON now.'
  ].join('\n');

  const response = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], {
    model: CLASSIFICATION_MODEL,
    temperature: 0,
    maxTokens: 320
  });

  const parsed = parseModelMultiClassification(response?.content || '');
  return resolveCandidatesFromModelSelection(candidates, parsed, maxMatches);
}

async function runClassificationMulti({ text, candidates, maxMatches }) {
  const normalizedMaxMatches = Number.isInteger(maxMatches)
    ? Math.max(1, Math.min(AUTO_CLASSIFICATION_MAX_MATCHES, maxMatches))
    : AUTO_CLASSIFICATION_MAX_MATCHES;

  try {
    const aiChoices = await selectCandidatesWithModelMulti({
      text,
      candidates,
      maxMatches: normalizedMaxMatches
    });
    if (aiChoices.length > 0) {
      return buildMultiClassificationResponse(aiChoices, {
        method: 'ai',
        fallbackUsed: false
      });
    }
  } catch (_error) {
    // Explicitly fallback to deterministic ranking if AI is unavailable or fails.
  }

  const ranked = rankByHeuristic(candidates, text);
  if (!ranked.length) {
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

  return buildMultiClassificationResponse(
    selected.map(entry => entry.candidate),
    {
      method: 'heuristic',
      fallbackUsed: true
    }
  );
}

async function classifyAgainstRubric({ db, userId, text, pillarId }) {
  const normalizedText = normalizeClassificationText(text);
  if (!normalizedText) {
    throw createClassificationError('text is required for classification', 400, 'missing_text');
  }

  const pillar = await getOwnedPillar({ db, userId, pillarId });
  const candidates = getRubricItems(pillar.pillarData)
    .filter(item => item && typeof item.id === 'string')
    .map(item => toCandidate(pillar.pillarId, item));

  requireNonEmptyCandidates(
    candidates,
    'Pillar has no rubric items. Add rubric items before using auto-classification.'
  );

  return runClassification({
    text: normalizedText,
    candidates,
    includePillar: false
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

  const candidates = [];
  for (const doc of pillarsSnapshot.docs) {
    const pillarData = doc.data() || {};
    const rubricItems = getRubricItems(pillarData);
    for (const rubricItem of rubricItems) {
      if (!rubricItem || typeof rubricItem.id !== 'string') {
        continue;
      }
      candidates.push(toCandidate(doc.id, rubricItem));
    }
  }

  requireNonEmptyCandidates(
    candidates,
    'No rubric items found. Add rubric items to at least one pillar before using classification.'
  );

  return runClassification({
    text: normalizedText,
    candidates,
    includePillar: true
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

  const candidates = [];
  for (const doc of pillarsSnapshot.docs) {
    const pillarData = doc.data() || {};
    const rubricItems = getRubricItems(pillarData);
    for (const rubricItem of rubricItems) {
      if (!rubricItem || typeof rubricItem.id !== 'string') {
        continue;
      }
      candidates.push(toCandidate(doc.id, rubricItem));
    }
  }

  requireNonEmptyCandidates(
    candidates,
    'No rubric items found. Add rubric items to at least one pillar before using classification.'
  );

  return runClassificationMulti({
    text: normalizedText,
    candidates,
    maxMatches
  });
}

module.exports = {
  createClassificationError,
  classifyAgainstRubric,
  classifyAcrossPillars,
  classifyAcrossPillarsMulti,
  rankByHeuristic
};
