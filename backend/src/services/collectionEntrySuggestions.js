const OpenAI = require('openai');
const { CollectionEntrySuggestion } = require('../models');

const SUGGESTION_TYPES = {
  FETCH_PRODUCT: 'fetch_product_suggestion',
  RECIPE: 'recipe_suggestion'
};

const SUGGESTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

let openaiClient = null;
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function extractJSON(content) {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  if (trimmed.includes('```')) {
    const clean = trimmed.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
      return clean;
    }
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return null;
}

async function generateFetchProductSuggestion(context, suggestionRecord) {
  const openai = getOpenAIClient();
  if (!openai) {
    await suggestionRecord.update({
      status: SUGGESTION_STATUS.FAILED,
      error: 'OpenAI API key not configured'
    });
    return;
  }

  const { entry, analysis } = context;
  console.log('[Suggestions] Generating fetch_product_suggestion for entry', entry.id);
  const description = analysis?.description || entry?.content || '';
  const tags = Array.isArray(analysis?.tags) ? analysis.tags.join(', ') : '';
  const title = analysis?.suggestedTitle || entry?.title || '';

  const userPrompt = [
    `Product description: ${description}`,
    title ? `Suggested title: ${title}` : null,
    tags ? `Tags: ${tags}` : null,
    'Return up to 5 purchase options.'
  ].filter(Boolean).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content: `You help users find products online. Respond ONLY with strict JSON.
Required format:
{
  "suggestions": [
    {
      "merchant": "Retailer name",
      "title": "Product title",
      "price": "Price with currency symbol if known, otherwise null",
      "url": "https://...",
      "notes": "Extra context like availability or shipping"
    }
  ]
}

Rules:
- Prefer well-known retailers (Amazon, Target, Walmart, Best Buy, brand site, etc.).
- Include unique URL per suggestion.
- Never fabricate impossible URLs (keep to domain root + reasonable path).
- If uncertain, omit the entry instead of guessing.`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const messageContent = response.choices?.[0]?.message?.content;
    const jsonString = extractJSON(messageContent);
    let payload = { suggestions: [] };

    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [];
        payload = {
          suggestions: suggestions.map(item => ({
            merchant: item.merchant || 'Unknown retailer',
            title: item.title || title || description,
            price: item.price || null,
            url: item.url || null,
            notes: item.notes || null
          }))
        };
      } catch (parseError) {
        await suggestionRecord.update({
          status: SUGGESTION_STATUS.FAILED,
          error: `Failed to parse product suggestion JSON: ${parseError.message}`
        });
        return;
      }
    }

    await suggestionRecord.update({
      status: SUGGESTION_STATUS.COMPLETED,
      payload
    });
    console.log('[Suggestions] fetch_product_suggestion completed with', payload.suggestions.length, 'options');
  } catch (error) {
    console.error('[Suggestions] fetch_product_suggestion failed:', error.response?.data || error.message);
    await suggestionRecord.update({
      status: SUGGESTION_STATUS.FAILED,
      error: error.message || 'Failed to generate product suggestions'
    });
  }
}

async function generateSuggestionsForCollectionEntry(context, types = [SUGGESTION_TYPES.FETCH_PRODUCT]) {
  if (!context || !context.collectionEntry || !context.entry) {
    console.warn('[Suggestions] Missing context, skipping suggestion generation');
    return;
  }

  const { collectionEntry, entry, userId, collection } = context;

  for (const type of types) {
    const suggestionRecord = await CollectionEntrySuggestion.create({
      collectionEntryId: collectionEntry.id,
      entryId: entry.id,
      collectionId: collectionEntry.collectionId || collection?.id || null,
      userId,
      type,
      status: SUGGESTION_STATUS.PENDING,
      metadata: {
        source: 'auto',
        version: 1
      }
    });

    switch (type) {
      case SUGGESTION_TYPES.FETCH_PRODUCT:
        await generateFetchProductSuggestion(context, suggestionRecord);
        break;
      default:
        await suggestionRecord.update({
          status: SUGGESTION_STATUS.FAILED,
          error: `Suggestion type ${type} not implemented`
        });
        break;
    }
  }
}

module.exports = {
  SUGGESTION_TYPES,
  SUGGESTION_STATUS,
  generateSuggestionsForCollectionEntry
};
