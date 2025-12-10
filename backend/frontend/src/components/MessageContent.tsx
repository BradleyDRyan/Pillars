import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlockType, Block } from '../utils/blockTypes';
import AmazonSearchCallBlock from './tool-blocks/AmazonSearchCallBlock';
import WebSearchCallBlock from './tool-blocks/WebSearchCallBlock';

interface MessageContentProps {
  messageId: string;
  blocks?: Block[];
  content?: string; // Fallback for legacy messages
  isStreaming?: boolean;
}

/**
 * Converts legacy content string to blocks
 */
function legacyContentToBlocks(content: string): Block[] {
  if (!content) return [];
  
  return [{
    type: BlockType.TEXT,
    data: { text: content },
    metadata: { sequence: 0 },
    key: `text-${Date.now()}`
  }];
}

/**
 * Renders a single block
 */
function renderBlock(block: Block, messageId: string, index: number, isStreaming: boolean): React.ReactNode {
  if (!block) return null;

  switch (block.type) {
    case BlockType.TEXT:
      const text = block.data?.text || '';
      if (!text || text.trim() === '') return null;
      
      return (
        <div key={block.key || `text-${index}`} className="markdown-content">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-2 mb-1" {...props} />,
              p: ({node, ...props}) => <p className="my-2" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc list-inside my-2 ml-4" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal list-inside my-2 ml-4" {...props} />,
              li: ({node, ...props}) => <li className="my-1" {...props} />,
              code: ({node, inline, ...props}: any) => 
                inline ? (
                  <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props} />
                ) : (
                  <code className="block bg-muted p-2 rounded text-sm font-mono overflow-x-auto my-2" {...props} />
                ),
              pre: ({node, ...props}) => <pre className="bg-muted p-2 rounded text-sm font-mono overflow-x-auto my-2" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-muted-foreground pl-4 my-2 italic" {...props} />,
              a: ({node, ...props}) => <a className="text-primary underline hover:text-primary/80" {...props} />,
            }}
          >
            {text}
          </ReactMarkdown>
          {isStreaming && !block.sealed && !block.metadata?.status && (
            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
          )}
        </div>
      );

    case BlockType.TOOL_USE:
      return renderToolCall(block, messageId, index);

    case BlockType.TOOL_RESULT:
      // Tool results are rendered with their corresponding tool_use blocks
      return null;

    default:
      return null;
  }
}

/**
 * Renders a tool call block with its results
 */
function renderToolCall(block: Block, messageId: string, index: number): React.ReactNode {
  if (block.type !== BlockType.TOOL_USE) return null;

  const toolName = block.data?.name || '';
  const toolInput = block.data?.input || {};
  const toolUseId = block.data?.id;

  // Find corresponding tool_result blocks
  // This will be handled by the parent component that has access to all blocks
  
  switch (toolName) {
    case 'search_amazon':
      return (
        <AmazonSearchCallBlock
          key={block.key || `tool-${index}`}
          data={{
            input: toolInput,
            parameters: toolInput,
            payload: toolInput
          }}
          metadata={{
            status: block.metadata?.status || 'pending'
          }}
          resultBlocks={[]} // Will be populated by parent component
        />
      );

    case 'web_search':
      // Extract query from input
      const query = typeof toolInput === 'string' 
        ? toolInput 
        : toolInput?.query || JSON.stringify(toolInput);
      
      return (
        <WebSearchCallBlock
          key={block.key || `tool-${index}`}
          data={{
            input: { query },
            parameters: { query },
            payload: { query }
          }}
          metadata={{
            status: block.metadata?.status || 'pending'
          }}
          resultBlocks={[]} // Will be populated by parent component
        />
      );

    // Add other tool types here
    default:
      return (
        <div key={block.key || `tool-${index}`} className="my-2 p-2 border rounded">
          <div className="text-xs font-medium text-muted-foreground">
            Tool: {toolName}
          </div>
          <pre className="text-xs mt-1 overflow-x-auto">
            {JSON.stringify(toolInput, null, 2)}
          </pre>
        </div>
      );
  }
}

/**
 * Groups tool_use and tool_result blocks together
 */
function groupToolBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];
  const toolResults = new Map<string, Block[]>();

  // First pass: collect tool_results by tool_use_id
  for (const block of blocks) {
    if (block.type === BlockType.TOOL_RESULT) {
      const toolUseId = block.data?.id || block.data?.tool_use_id;
      if (toolUseId) {
        if (!toolResults.has(toolUseId)) {
          toolResults.set(toolUseId, []);
        }
        toolResults.get(toolUseId)!.push(block);
      }
    }
  }

  // Second pass: add blocks, inserting tool_results after their tool_use
  for (const block of blocks) {
    if (block.type === BlockType.TOOL_USE) {
      result.push(block);
      // Add corresponding tool_results
      const toolUseId = block.data?.id;
      if (toolUseId && toolResults.has(toolUseId)) {
        result.push(...toolResults.get(toolUseId)!);
      }
    } else if (block.type !== BlockType.TOOL_RESULT) {
      // Add non-tool-result blocks
      result.push(block);
    }
  }

  return result;
}

export default function MessageContent({
  messageId,
  blocks,
  content,
  isStreaming = false
}: MessageContentProps) {
  // Use blocks if available, otherwise convert legacy content
  const displayBlocks = useMemo(() => {
    if (blocks && blocks.length > 0) {
      return groupToolBlocks(blocks);
    }
    if (content) {
      return legacyContentToBlocks(content);
    }
    return [];
  }, [blocks, content]);

  if (displayBlocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {displayBlocks.map((block, index) => 
        renderBlock(block, messageId, index, isStreaming)
      )}
    </div>
  );
}

