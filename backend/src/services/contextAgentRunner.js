const { logger } = require('../config/firebase');
const { chatCompletion } = require('./anthropic');
const Monitor = require('../models/Monitor');
const MonitorAssignment = require('../models/MonitorAssignment');
const Person = require('../models/Person');
const Signal = require('../models/Signal');

const parseJsonResponse = rawContent => {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Claude returned an empty response');
  }

  const trimmed = rawContent.trim();

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonString = codeFenceMatch ? codeFenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error({ err: error, rawContent }, '[context-agent] Failed to parse JSON output');
    throw new Error('Agent response could not be parsed as JSON');
  }
};

const buildMonitorMessages = (monitor, person, recentSignals = []) => {
  const systemPrompt = `You are an autonomous relationship intelligence agent that creates signals for the Squirrel personal CRM.
You must always respond with a single JSON object that matches this TypeScript interface:
{
  "type": string;              // short title for the signal (max 80 chars)
  "description": string;       // 1-2 sentence summary written in the third person
  "importance": number;        // integer from 0-100 (50 is neutral)
  "occurredAt"?: string;       // optional ISO 8601 date string. If omitted use "now".
}

Guidelines:
- Use clear, human friendly language.
- Ground your insight in the provided person information and agent goal.
- DO NOT return signals that are duplicates or too similar to recently created ones.
- If you truly cannot produce a meaningful insight, set type to "no_update" and provide a short explanation.`;

  const personDetails = [
    `Name: ${person.name}`,
    `Relationship: ${person.relationship || 'Unknown'}`,
    `Shared interests: ${
      person.sharedInterests && person.sharedInterests.length > 0
        ? person.sharedInterests.join(', ')
        : 'None listed'
    }`
  ];

  const userPromptParts = [
    `Monitor name: ${monitor.name}`,
    `Monitor goal/instructions:\n${monitor.instructions}`,
    '',
    'Person profile:',
    ...personDetails
  ];

  // Add recent signals section if any exist
  if (recentSignals.length > 0) {
    userPromptParts.push('');
    userPromptParts.push('Recently created signals (DO NOT duplicate these):');
    recentSignals.forEach(signal => {
      userPromptParts.push(`- ${signal.type}`);
    });
  }

  userPromptParts.push('');
  userPromptParts.push('Generate the JSON payload now. Remember: no markdown, no commentary');

  const userPrompt = userPromptParts.join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
};

const sanitizeImportance = value => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 50;
  }
  return Math.max(0, Math.min(Math.round(numberValue), 100));
};

const runMonitorAssignment = async (assignmentId, options = {}) => {
  const assignment = await MonitorAssignment.findById(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found');
  }

  const monitor = await Monitor.findById(assignment.monitorId);
  if (!monitor) {
    throw new Error('Monitor not found for assignment');
  }

  const person = await Person.findById(assignment.personId);
  if (!person) {
    throw new Error('Person not found for assignment');
  }

  const previousRunCount = Number.isFinite(assignment.runCount) ? assignment.runCount : 0;

  logger.info(
    {
      assignmentId: assignment.id,
      monitorId: monitor.id,
      personId: person.id,
      model: options.model || monitor.model || 'default',
      enableWebSearch: monitor.enableWebSearch
    },
    '[monitor] Starting run'
  );

  const startTime = new Date();

  await MonitorAssignment.update(assignment.id, {
    status: 'running',
    lastRunAt: startTime,
    lastError: null
  });

  try {
    // Fetch recent signals from this monitor for this person (last 10)
    const recentSignalsSnapshot = await Signal.collection()
      .where('monitorId', '==', monitor.id)
      .where('personId', '==', person.id)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const recentSignals = recentSignalsSnapshot.docs.map(doc => Signal.fromDoc(doc));

    const messages = buildMonitorMessages(monitor, person, recentSignals);
    const claudeResponse = await chatCompletion(messages, {
      model: options.model || monitor.model || undefined,
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens || 600,
      useWebSearch: monitor.enableWebSearch,
      webSearchMaxUses: options.webSearchMaxUses
    });

    const parsed = parseJsonResponse(claudeResponse.content);

    if (parsed.type === 'no_update') {
      logger.info(
        { assignmentId: assignment.id, monitorId: monitor.id, reason: parsed.description },
        '[monitor] No meaningful update returned'
      );

      const updatedAssignment = await MonitorAssignment.update(assignment.id, {
        status: 'idle',
        runCount: previousRunCount + 1,
        lastResult: {
          type: 'no_update',
          message: parsed.description,
          completedAt: new Date().toISOString()
        }
      });

      return {
        assignment: updatedAssignment,
        monitor,
        signal: null,
        event: null,
        person
      };
    }

    const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
    const importance = sanitizeImportance(parsed.importance);

    const signal = await Signal.create({
      userId: person.userId,
      personId: person.id,
      monitorId: monitor.id,
      type: parsed.type || monitor.name,
      source: `monitor:${monitor.name}`,
      description: parsed.description || '',
      importance,
      occurredAt,
      metadata: {
        assignmentId: assignment.id,
        monitorName: monitor.name,
        model: options.model || monitor.model || null,
        runStartedAt: startTime.toISOString(),
        enableWebSearch: monitor.enableWebSearch,
        rawAiOutput: claudeResponse.content
      }
    });

    const updatedAssignment = await MonitorAssignment.update(assignment.id, {
      status: 'idle',
      runCount: previousRunCount + 1,
      lastResult: {
        signalId: signal.id,
        type: signal.type,
        importance: signal.importance,
        occurredAt: signal.occurredAt.toISOString(),
        description: signal.description
      }
    });

    logger.info(
      { assignmentId: assignment.id, monitorId: monitor.id, signalId: signal.id, personId: person.id },
      '[monitor] Run completed with signal'
    );

    return {
      assignment: updatedAssignment,
      monitor,
      signal,
      person
    };
  } catch (error) {
    logger.error(
      { err: error, assignmentId: assignment.id, monitorId: monitor.id },
      '[monitor] Run failed'
    );
    const updatedAssignment = await MonitorAssignment.update(assignment.id, {
      status: 'error',
      lastError: error.message,
      runCount: previousRunCount + 1
    });

    throw Object.assign(new Error(error.message || 'Monitor run failed'), {
      assignment: updatedAssignment,
      monitor,
      person
    });
  }
};

module.exports = {
  runMonitorAssignment
};
