import React, { useMemo } from 'react';
import ResearchBlock from './ResearchBlock';
import { ExternalLink } from 'lucide-react';

interface AmazonSearchCallBlockProps {
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
    return "Couldn't complete the Amazon search";
  }

  if (!payload) {
    return status === 'running'
      ? 'Searching Amazon…'
      : 'Amazon search ready';
  }

  const count = Array.isArray(payload.items) ? payload.items.length : 0;
  if (status === 'running') {
    return count > 0 ? `Reviewing ${count} listings…` : 'Searching Amazon…';
  }

  if (count === 0) {
    return 'No products found on Amazon';
  }

  const noun = count === 1 ? 'listing' : 'listings';
  return `Found ${count} ${noun} on Amazon`;
};

const renderSearchResults = (payload: any) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No products matched this search.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item: any, idx: number) => {
        const key = item.asin || item.url || item.title || idx;
        const faviconUrl = item.url
          ? `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`
          : null;

        return (
          <div
            key={key}
            className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
          >
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline flex items-center gap-1 group"
                >
                  <span className="truncate">{item.title || 'Amazon listing'}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
              ) : (
                <span className="text-sm font-medium truncate block">
                  {item.title || 'Amazon listing'}
                </span>
              )}
              {item.price && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.price}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function AmazonSearchCallBlock({
  data = {},
  metadata = {},
  resultBlocks = []
}: AmazonSearchCallBlockProps) {
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
    if (payload?.domain) {
      chips.push(`amazon.${payload.domain}`);
    }
    if (metadata.provider || payload?.provider) {
      chips.push(String(metadata.provider || payload?.provider));
    }
    return chips;
  }, [metadata.provider, payload]);

  let responseContent: React.ReactNode = null;

  if (isError) {
    const errorMessage = payload?.error || metadata.error || 'There was an error searching Amazon.';
    responseContent = (
      <div className="text-sm text-red-500">
        {errorMessage}
      </div>
    );
  } else if (payload?.success) {
    responseContent = renderSearchResults(payload);
  }

  return (
    <ResearchBlock
      toolName="search_amazon"
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

