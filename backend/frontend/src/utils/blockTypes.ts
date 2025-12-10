/**
 * Block types for message content
 * Each block represents a single unit of content (text, tool call, tool result, etc.)
 */

export const BlockType = {
  TEXT: 'text',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  UI_COMPONENT: 'ui_component',
  WEB_SEARCH: 'web_search',
  WEB_FETCH: 'web_fetch',
  PLAN: 'plan',
  UNKNOWN: 'unknown'
} as const;

export type BlockTypeValue = typeof BlockType[keyof typeof BlockType];

export interface Block {
  type: BlockTypeValue;
  data: any;
  metadata?: {
    status?: 'pending' | 'running' | 'complete' | 'error';
    sequence?: number;
    [key: string]: any;
  };
  sealed?: boolean;
  key?: string;
}

export function createBlock(
  type: BlockTypeValue,
  data: any = {},
  metadata: any = {}
): Block {
  return {
    type,
    data,
    metadata: {
      ...metadata,
      sequence: metadata.sequence ?? Date.now()
    },
    key: metadata.key || `${type}-${Date.now()}-${Math.random()}`
  };
}

export function createTextBlock(text: string, metadata: any = {}): Block {
  return createBlock(BlockType.TEXT, { text }, metadata);
}

export function createToolUseBlock(
  name: string,
  input: any,
  id?: string,
  metadata: any = {}
): Block {
  return createBlock(
    BlockType.TOOL_USE,
    {
      id: id || `tool-${Date.now()}-${Math.random()}`,
      name,
      input
    },
    metadata
  );
}

export function createToolResultBlock(
  toolUseId: string,
  name: string,
  content: any,
  isError: boolean = false,
  metadata: any = {}
): Block {
  return createBlock(
    BlockType.TOOL_RESULT,
    {
      id: toolUseId,
      name,
      rawContent: typeof content === 'string' ? content : JSON.stringify(content),
      parsed: typeof content === 'object' ? content : null,
      isError
    },
    metadata
  );
}


