import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// API base URL - adjust for your environment
const API_BASE = import.meta.env.VITE_API_URL || '';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'complete' | 'error';
  result?: unknown;
}

// Simple markdown renderer - handles basic markdown
function Markdown({ content }: { content: string }) {
  // Process markdown content
  const processMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLang = '';
    
    lines.forEach((line, idx) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.slice(3).trim();
          codeBlockContent = '';
        } else {
          inCodeBlock = false;
          elements.push(
            <pre key={`code-${idx}`} className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto my-3 text-sm">
              <code className={codeBlockLang ? `language-${codeBlockLang}` : ''}>
                {codeBlockContent.trim()}
              </code>
            </pre>
          );
        }
        return;
      }
      
      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        return;
      }
      
      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={idx} className="text-lg font-semibold mt-4 mb-2">{processInline(line.slice(4))}</h3>);
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={idx} className="text-xl font-semibold mt-4 mb-2">{processInline(line.slice(3))}</h2>);
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(<h1 key={idx} className="text-2xl font-bold mt-4 mb-2">{processInline(line.slice(2))}</h1>);
        return;
      }
      
      // Lists
      if (line.match(/^[-*]\s/)) {
        elements.push(
          <li key={idx} className="ml-4 list-disc">{processInline(line.slice(2))}</li>
        );
        return;
      }
      if (line.match(/^\d+\.\s/)) {
        elements.push(
          <li key={idx} className="ml-4 list-decimal">{processInline(line.replace(/^\d+\.\s/, ''))}</li>
        );
        return;
      }
      
      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={idx} className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-2">
            {processInline(line.slice(2))}
          </blockquote>
        );
        return;
      }
      
      // Empty lines
      if (line.trim() === '') {
        elements.push(<br key={idx} />);
        return;
      }
      
      // Regular paragraphs
      elements.push(<p key={idx} className="my-1">{processInline(line)}</p>);
    });
    
    return elements;
  };
  
  // Process inline markdown (bold, italic, code, links)
  const processInline = (text: string): React.ReactNode => {
    // Process in order: code, bold, italic, links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyCounter = 0;
    
    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Bold
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Italic
      const italicMatch = remaining.match(/\*([^*]+)\*/);
      // Links
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      
      // Find earliest match
      const matches = [
        codeMatch && { type: 'code', match: codeMatch, idx: codeMatch.index! },
        boldMatch && { type: 'bold', match: boldMatch, idx: boldMatch.index! },
        italicMatch && { type: 'italic', match: italicMatch, idx: italicMatch.index! },
        linkMatch && { type: 'link', match: linkMatch, idx: linkMatch.index! },
      ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);
      
      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }
      
      const earliest = matches[0]!;
      
      // Add text before match
      if (earliest.idx > 0) {
        parts.push(remaining.slice(0, earliest.idx));
      }
      
      // Add formatted content
      const k = keyCounter++;
      switch (earliest.type) {
        case 'code':
          parts.push(<code key={k} className="bg-slate-200 px-1 py-0.5 rounded text-sm font-mono">{earliest.match[1]}</code>);
          remaining = remaining.slice(earliest.idx + earliest.match[0].length);
          break;
        case 'bold':
          parts.push(<strong key={k}>{earliest.match[1]}</strong>);
          remaining = remaining.slice(earliest.idx + earliest.match[0].length);
          break;
        case 'italic':
          parts.push(<em key={k}>{earliest.match[1]}</em>);
          remaining = remaining.slice(earliest.idx + earliest.match[0].length);
          break;
        case 'link':
          parts.push(
            <a key={k} href={earliest.match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {earliest.match[1]}
            </a>
          );
          remaining = remaining.slice(earliest.idx + earliest.match[0].length);
          break;
      }
    }
    
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };
  
  return <div className="prose prose-slate max-w-none">{processMarkdown(content)}</div>;
}

// Tool call block component
function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const getToolIcon = () => {
    switch (toolCall.status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };
  
  const getToolLabel = (name: string) => {
    const labels: Record<string, string> = {
      'list_pillars': 'Listing pillars...',
      'create_pillar': 'Creating pillar...',
      'create_theme': 'Creating theme...',
      'create_principle': 'Creating principle...',
      'approve_principles': 'Approving principles...',
      'list_draft_principles': 'Listing draft principles...',
    };
    return labels[name] || name;
  };
  
  return (
    <Card className="p-3 my-2 bg-slate-50 border-slate-200">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">
          {toolCall.status === 'running' ? getToolLabel(toolCall.name) : toolCall.name}
        </span>
        {getToolIcon()}
      </div>
      {toolCall.status === 'complete' && toolCall.result ? (
        <div className="mt-2 text-xs text-slate-600">
          {renderToolResult(toolCall.name, toolCall.result as Record<string, unknown>)}
        </div>
      ) : null}
    </Card>
  );
}

// Render tool results nicely
function renderToolResult(toolName: string, data: Record<string, unknown>): React.ReactNode {
  if (toolName === 'create_pillar') {
    if (data.alreadyExists) {
      return <span>Pillar already exists: <Badge variant="secondary">{(data.pillar as {title: string}).title}</Badge></span>;
    }
    return <span>Created pillar: <Badge variant="default">{(data.pillar as {title: string}).title}</Badge></span>;
  }
  
  if (toolName === 'create_theme') {
    if (data.alreadyExists) {
      return <span>Theme already exists: <Badge variant="secondary">{(data.theme as {title: string}).title}</Badge></span>;
    }
    return <span>Created theme: <Badge variant="default">{(data.theme as {title: string}).title}</Badge></span>;
  }
  
  if (toolName === 'create_principle') {
    return (
      <span>
        Created principle: <Badge variant="default">{(data.principle as {title: string}).title}</Badge>
        <Badge variant="outline" className="ml-2">Draft</Badge>
      </span>
    );
  }
  
  if (toolName === 'list_pillars') {
    const pillars = data.pillars as Array<{title: string; themes: Array<{title: string}>}>;
    return (
      <div className="space-y-1">
        {pillars.map((p, i) => (
          <div key={i}>
            <Badge variant="secondary">{p.title}</Badge>
            {p.themes.length > 0 && (
              <span className="text-slate-500 ml-2">
                ({p.themes.map(t => t.title).join(', ')})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  
  if (toolName === 'list_draft_principles') {
    const drafts = data.drafts as Array<{title: string; pillar: string; theme: string}>;
    if (drafts.length === 0) {
      return <span className="text-slate-500">No draft principles</span>;
    }
    return (
      <div className="space-y-1">
        {drafts.slice(0, 5).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Badge variant="outline">{d.title}</Badge>
            <span className="text-slate-400">{d.pillar} → {d.theme}</span>
          </div>
        ))}
        {drafts.length > 5 && <span className="text-slate-500">...and {drafts.length - 5} more</span>}
      </div>
    );
  }
  
  if (toolName === 'approve_principles') {
    const approved = data.approved as Array<{title: string}>;
    return <span>Approved {approved.length} principle(s)</span>;
  }
  
  return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
}

// Main chat component
export function AdminChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending message
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      toolCalls: [],
    };
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsStreaming(true);
    
    try {
      // Build message history for API
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      const response = await fetch(`${API_BASE}/api/admin-chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start chat stream');
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              handleStreamEvent(event, assistantMessage.id);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessage.id 
          ? { ...m, content: m.content + '\n\n*Error: Failed to get response*' }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  };
  
  // Handle stream events
  const handleStreamEvent = (event: { type: string; data: unknown }, messageId: string) => {
    switch (event.type) {
      case 'text':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: m.content + (event.data as string) }
            : m
        ));
        break;
        
      case 'tool_start':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { 
                ...m, 
                toolCalls: [...(m.toolCalls || []), {
                  id: (event.data as {id: string}).id,
                  name: (event.data as {name: string}).name,
                  status: 'running' as const,
                }]
              }
            : m
        ));
        break;
        
      case 'tool_executing':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { 
                ...m, 
                toolCalls: m.toolCalls?.map(tc => 
                  tc.id === (event.data as {id: string}).id
                    ? { ...tc, input: (event.data as {input: Record<string, unknown>}).input }
                    : tc
                )
              }
            : m
        ));
        break;
        
      case 'tool_result':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { 
                ...m, 
                toolCalls: m.toolCalls?.map(tc => 
                  tc.id === (event.data as {id: string}).id
                    ? { ...tc, status: 'complete' as const, result: (event.data as {result: unknown}).result }
                    : tc
                )
              }
            : m
        ));
        break;
        
      case 'tool_error':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { 
                ...m, 
                toolCalls: m.toolCalls?.map(tc => 
                  tc.id === (event.data as {id: string}).id
                    ? { ...tc, status: 'error' as const }
                    : tc
                )
              }
            : m
        ));
        break;
        
      case 'done':
        // Stream complete
        break;
        
      case 'error':
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: m.content + `\n\n*Error: ${(event.data as {message: string}).message}*` }
            : m
        ));
        break;
    }
  };
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Content Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Chat with AI to create and manage pillars, themes, and principles
        </p>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Bot className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Welcome to the Content Assistant</p>
            <p className="text-sm max-w-md mx-auto">
              I can help you create pillars, themes, and principles. Try saying:
            </p>
            <div className="mt-4 space-y-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInput('What pillars do we have?')}
              >
                "What pillars do we have?"
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInput('Create a new pillar called Health')}
                className="ml-2"
              >
                "Create a pillar called Health"
              </Button>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
              {message.role === 'user' ? (
                <Card className="px-4 py-3 bg-primary text-primary-foreground">
                  <p>{message.content}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {message.toolCalls?.map((tc) => (
                    <ToolCallBlock key={tc.id} toolCall={tc} />
                  ))}
                  {message.content && (
                    <Card className="px-4 py-3 bg-muted">
                      <Markdown content={message.content} />
                    </Card>
                  )}
                  {!message.content && !message.toolCalls?.length && isStreaming && (
                    <Card className="px-4 py-3 bg-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </Card>
                  )}
                </div>
              )}
            </div>
            
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
            disabled={isStreaming}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isStreaming}
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
