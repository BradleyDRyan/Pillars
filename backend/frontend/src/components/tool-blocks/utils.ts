/**
 * Utility functions for parsing and handling tool calls
 */

export const ACTIVE_TOOL_STATUSES = new Set(['tool_call', 'pending', 'running']);

export const computeCallStatus = ({ callStatus, hasResult, isError }: {
  callStatus?: string | null;
  hasResult: boolean;
  isError: boolean;
}): 'pending' | 'running' | 'success' | 'error' => {
  if (isError) {
    return 'error';
  }
  if (hasResult) {
    return 'success';
  }
  if (callStatus && ACTIVE_TOOL_STATUSES.has(callStatus)) {
    return 'running';
  }
  return 'pending';
};

export const formatFriendlyName = (name: string = ''): string => {
  if (!name) return 'assistant';
  switch (name) {
    case 'create_plan':
      return 'your plan';
    case 'web_search':
      return 'web search';
    case 'web_fetch':
      return 'web page';
    case 'search_amazon':
      return 'Amazon search';
    case 'fetch_amazon_product':
      return 'Amazon product details';
    default:
      return name.replace(/_/g, ' ');
  }
};

export const stringifyPayload = (payload: any): string | null => {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof payload === 'object') {
    try {
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      return String(payload);
    }
  }

  return String(payload);
};

export const buildMetadataList = (...values: any[]): string[] =>
  values
    .flat()
    .map((value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (value && typeof value === 'object' && value.label) return value.label;
      return null;
    })
    .filter((v): v is string => Boolean(v));

/**
 * Parse tool calls from message content
 * Looks for XML-like tags or JSON structures
 */
export const parseToolCalls = (content: string): Array<{
  name: string;
  input?: any;
  id?: string;
}> => {
  const toolCalls: Array<{ name: string; input?: any; id?: string }> = [];

  // Try to parse XML-like tool call tags: <tool_name>...</tool_name>
  const xmlPattern = /<(\w+)>(.*?)<\/\1>/gs;
  let match;
  while ((match = xmlPattern.exec(content)) !== null) {
    const [, toolName, innerContent] = match;
    try {
      const parsed = JSON.parse(innerContent.trim());
      toolCalls.push({ name: toolName, input: parsed });
    } catch {
      toolCalls.push({ name: toolName, input: innerContent.trim() });
    }
  }

  // Try to parse JSON tool calls: {"tool": "name", "input": {...}}
  const jsonPattern = /\{"tool":\s*"([^"]+)",\s*"input":\s*(\{.*?\})\}/gs;
  while ((match = jsonPattern.exec(content)) !== null) {
    try {
      const toolName = match[1];
      const input = JSON.parse(match[2]);
      toolCalls.push({ name: toolName, input });
    } catch {
      // Skip invalid JSON
    }
  }

  return toolCalls;
};


