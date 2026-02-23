const { chatCompletion } = require('./anthropic');
const { getRubricItems } = require('../utils/rubrics');

const CLASSIFICATION_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const MAX_TEXT_LENGTH = 1200;

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

function parseModelClassification(content) {
  if (typeof content !== 'string' || !content.trim()) {
    return null;
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

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
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

function rubricItemSortId(candidate) {
  const rubricId = typeof candidate?.rubricItem?.id === 'string' ? candidate.rubricItem.id : '';
  const pillarId = typeof candidate?.pillarId === 'string' ? candidate.pillarId : '';
  return `${rubricId}::${pillarId}`;
}

function chooseByHeuristic(candidates, text) {
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

  const maxScore = scored.reduce((current, item) => Math.max(current, item.score), 0);
  if (maxScore === 0) {
    const fallbackPool = [...scored].sort((left, right) => {
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
    return fallbackPool[0]?.candidate || null;
  }

  const ordered = [...scored].sort((left, right) => {
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

  return ordered[0]?.candidate || null;
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

module.exports = {
  createClassificationError,
  classifyAgainstRubric,
  classifyAcrossPillars
};
