import React, { useMemo } from 'react';
import ResearchBlock from './ResearchBlock';

interface WebSearchCallBlockProps {
  data?: {
    input?: any;
    parameters?: any;
    payload?: any;
  };
  metadata?: {
    status?: string;
    provider?: string;
    error?: string;
  };
  resultBlocks?: any[];
}

const normalizeResult = (resultBlocks: any[] = []) => {
  if (!Array.isArray(resultBlocks)) {
    return null;
  }

  for (let index = resultBlocks.length - 1; index >= 0; index -= 1) {
    const block = resultBlocks[index];
    if (!block || block.type !== 'tool_result') {
      continue;
    }

    const parsed = block.data?.parsed ?? block.data?.rawContent ?? block.data?.content ?? null;
    let data = parsed;

    if (typeof parsed === 'string') {
      try {
        data = JSON.parse(parsed);
      } catch (error) {
        data = null;
      }
    } else if (parsed && typeof parsed === 'object') {
      data = parsed;
    }

    return {
      data,
      metadata: block.metadata || {},
      isError: Boolean(block.data?.isError || block.metadata?.status === 'error')
    };
  }

  return null;
};

const buildSubtitle = ({ isError, status, payload }: { isError: boolean; status?: string; payload?: any }) => {
  if (isError) {
    return "Couldn't complete the web search";
  }

  if (!payload) {
    return status === 'running'
      ? 'Searching the web…'
      : 'Web search ready';
  }

  if (status === 'running') {
    return 'Searching the web…';
  }

  return 'Web search completed';
};

export default function WebSearchCallBlock({
  data = {},
  metadata = {},
  resultBlocks = []
}: WebSearchCallBlockProps) {
  const callStatus = metadata.status || (data as any).status || null;
  const result = useMemo(
    () => normalizeResult(resultBlocks),
    [resultBlocks]
  );

  const payload = result?.data;
  const isError = Boolean(
    result?.isError ||
    payload?.success === false ||
    metadata.status === 'error'
  );
  const status = useMemo(() => {
    if (isError) return 'error';
    if (payload?.success) return 'success';
    if (callStatus === 'running' || callStatus === 'tool_call' || callStatus === 'pending') return 'running';
    return 'pending';
  }, [isError, payload?.success, callStatus]);

  const subtitle = buildSubtitle({ isError, status, payload });
  const requestPayload = useMemo(() => {
    const input = data.input ?? data.parameters ?? data.payload ?? null;
    if (!input) return null;
    if (typeof input === 'string') {
      return input.trim() || null;
    }
    if (typeof input === 'object' && input.query) {
      return input.query;
    }
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  }, [data.input, data.parameters, data.payload]);

  const metadataChips = useMemo(() => {
    const chips: string[] = [];
    if (payload?.query) {
      chips.push(`Query: ${payload.query}`);
    }
    if (metadata.provider || payload?.provider) {
      chips.push(String(metadata.provider || payload?.provider));
    }
    return chips;
  }, [metadata.provider, payload]);

  let responseContent: React.ReactNode = null;

  if (isError) {
    const errorMessage = payload?.error || metadata.error || 'There was an error performing the web search.';
    responseContent = (
      <div className="text-sm text-red-500">
        {errorMessage}
      </div>
    );
  } else if (payload?.success) {
    responseContent = (
      <div className="text-sm text-muted-foreground">
        Search completed successfully
      </div>
    );
  }

  return (
    <ResearchBlock
      toolName="web_search"
      status={status}
      subtitle={subtitle}
      metadata={metadataChips}
      request={requestPayload}
      response={responseContent}
      wrapResponse={false}
      defaultExpanded={false}
    />
  );
}


