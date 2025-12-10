const axios = require('axios');
const { logger } = require('../config/firebase');

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const buildMockResults = (query) => ({
  query,
  results: [
    {
      title: 'Configure Brave Search',
      url: 'https://brave.com/search/api/',
      snippet:
        'Sign up for the Brave Search API and set BRAVE_SEARCH_API_KEY in your environment to enable live results.'
    },
    {
      title: `Mock result for "${query}"`,
      url: 'https://example.com',
      snippet: 'This is placeholder data shown when BRAVE_SEARCH_API_KEY is missing.'
    }
  ],
  totalResults: 2,
  provider: 'Mock (Brave Search disabled)',
  status: 'mock'
});

const mapBraveResults = (data) => {
  const results = (data.web?.results || []).map((item) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.description || '',
    age: item.age || null,
    favicon: item.profile?.img || null
  }));

  if (data.infobox) {
    results.unshift({
      title: data.infobox.title || 'Quick Answer',
      url: data.infobox.url || '',
      snippet: data.infobox.description || data.infobox.long_desc || '',
      isAnswer: true
    });
  }

  return {
    query: data.query || '',
    results,
    totalResults: data.web?.total || results.length,
    provider: 'Brave Search',
    status: 'complete'
  };
};

const performWebSearch = async (query, options = {}) => {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    logger.warn('[webSearchService] BRAVE_SEARCH_API_KEY missing, returning mock results');
    return buildMockResults(query);
  }

  if (!query || !query.trim()) {
    throw new Error('query is required');
  }

  const params = new URLSearchParams({
    q: query.trim(),
    count: String(options.maxResults || 8)
  });

  try {
    const response = await axios.get(`${BRAVE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      timeout: 10_000
    });

    logger.debug(
      { query, resultCount: response.data?.web?.results?.length || 0 },
      '[webSearchService] Brave search succeeded'
    );

    return mapBraveResults({ ...response.data, query });
  } catch (error) {
    logger.error(
      {
        err: error?.response?.data || error.message,
        query,
        status: error?.response?.status
      },
      '[webSearchService] Brave search failed'
    );
    throw new Error(error?.response?.data?.message || 'Failed to complete Brave search');
  }
};

module.exports = {
  performWebSearch
};

