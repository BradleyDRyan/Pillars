import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, Check, Loader2, MessageSquare, Plus, Send, AlertCircle, Wrench } from "lucide-react";

// Types
type ContentBlock = {
  type: 'text' | 'tool_use' | 'tool_result';
  data: {
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    content?: unknown;
    isError?: boolean;
  };
  metadata: {
    sequence: number;
    status: string;
    groupId?: string;
    timestamp?: string;
  };
};

type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  agentId: string | null;
  agentHandle: string | null;
  agentName: string | null;
  contents: ContentBlock[];
  mentions: string[];
  createdAt: string | { seconds: number; nanoseconds?: number } | Date;
};

type Conversation = {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
};

type Agent = {
  id: string;
  name: string;
  handle: string;
  description: string;
};

// Markdown component for rendering text with basic formatting
function Markdown({ children }: { children: string }) {
  const html = children
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br />');
  
  return (
    <div 
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
}

// Tool block component for rendering tool calls and results inline
function ToolBlock({ block, groupedResult }: { 
  block: ContentBlock; 
  groupedResult?: ContentBlock;
}) {
  const isComplete = block.metadata.status === 'complete' || groupedResult?.metadata.status === 'complete';
  const isError = groupedResult?.data.isError;
  const toolName = block.data.name || 'Tool';
  
  const formatResult = (data: unknown): string => {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    return String(data);
  };

  return (
    <div className="my-2 rounded-lg border bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{toolName}</span>
        {isError ? (
          <AlertCircle className="h-4 w-4 text-destructive ml-auto" />
        ) : isComplete ? (
          <Check className="h-4 w-4 text-green-600 ml-auto" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>
      
      {groupedResult && groupedResult.data.content ? (
        <div className="px-3 py-2 text-sm">
          {isError ? (
            <div className="text-destructive">
              {String(formatResult(groupedResult.data.content))}
            </div>
          ) : (
            <div className="space-y-1">
              {renderToolResult(toolName, groupedResult.data.content as Record<string, unknown>)}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Helper to render tool results nicely
function renderToolResult(toolName: string, data: Record<string, unknown>): React.ReactNode {
  // Handle pillar/theme/principle creation results
  if (data.created && data.pillar) {
    const pillar = data.pillar as { id: string; title: string };
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Created pillar:</Badge>
        <span className="font-medium">{pillar.title}</span>
      </div>
    );
  }
  
  if (data.created && data.theme) {
    const theme = data.theme as { id: string; title: string };
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Created theme:</Badge>
        <span className="font-medium">{theme.title}</span>
      </div>
    );
  }
  
  if (data.created && data.principle) {
    const principle = data.principle as { id: string; title: string };
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Created principle:</Badge>
        <span className="font-medium">{principle.title}</span>
        {data.isDraft ? <Badge variant="outline">Draft</Badge> : null}
      </div>
    );
  }
  
  // Handle list results
  if (data.pillars && Array.isArray(data.pillars)) {
    const pillars = data.pillars as { id: string; title: string; themes?: { title: string }[] }[];
    return (
      <div className="space-y-1">
        {pillars.map((pillar, i) => (
          <div key={i}>
            <Badge>{pillar.title}</Badge>
            {pillar.themes && pillar.themes.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                ({pillar.themes.map(t => t.title).join(', ')})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  
  if (data.drafts && Array.isArray(data.drafts)) {
    const drafts = data.drafts as { title: string; pillar: string; theme: string }[];
    if (drafts.length === 0) {
      return <span className="text-muted-foreground">No drafts pending</span>;
    }
    return (
      <div className="space-y-1">
        {drafts.map((draft, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">{draft.title}</span>
            <span className="text-muted-foreground"> in {draft.pillar} → {draft.theme}</span>
          </div>
        ))}
      </div>
    );
  }
  
  if (data.approved && Array.isArray(data.approved)) {
    const approved = data.approved as { id: string; title: string }[];
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Approved:</Badge>
        <span>{approved.map(a => a.title).join(', ')}</span>
      </div>
    );
  }
  
  // Default: show as JSON
  return (
    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// Message content component - renders blocks in sequence
function MessageContent({ contents }: { contents: ContentBlock[] }) {
  // Sort by sequence
  const sortedBlocks = [...contents].sort((a, b) => 
    (a.metadata?.sequence ?? 0) - (b.metadata?.sequence ?? 0)
  );
  
  // Group tool_use with their tool_result by groupId
  const toolResultMap = new Map<string, ContentBlock>();
  sortedBlocks.forEach(block => {
    if (block.type === 'tool_result' && block.metadata.groupId) {
      toolResultMap.set(block.metadata.groupId, block);
    }
  });
  
  // Render blocks, skipping tool_result (they're shown with tool_use)
  return (
    <div className="space-y-1">
      {sortedBlocks.map((block, index) => {
        if (block.type === 'text' && block.data.text) {
          return (
            <Markdown key={`text-${index}`}>
              {block.data.text}
            </Markdown>
          );
        }
        
        if (block.type === 'tool_use') {
          const groupedResult = block.metadata.groupId 
            ? toolResultMap.get(block.metadata.groupId)
            : undefined;
          return (
            <ToolBlock 
              key={`tool-${index}`} 
              block={block} 
              groupedResult={groupedResult}
            />
          );
        }
        
        // Skip standalone tool_result (rendered with tool_use)
        if (block.type === 'tool_result') {
          return null;
        }
        
        return null;
      })}
    </div>
  );
}

// Mention autocomplete popup
function MentionPopup({ 
  agents, 
  filter, 
  onSelect, 
  visible 
}: { 
  agents: Agent[]; 
  filter: string; 
  onSelect: (handle: string) => void;
  visible: boolean;
}) {
  const filteredAgents = agents.filter(a => 
    a.handle.toLowerCase().includes(filter.toLowerCase()) ||
    a.name.toLowerCase().includes(filter.toLowerCase())
  );
  
  if (!visible || filteredAgents.length === 0) return null;
  
  return (
    <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-md shadow-lg overflow-hidden z-50">
      {filteredAgents.map(agent => (
        <button
          key={agent.id}
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
          onClick={() => onSelect(agent.handle)}
        >
          <Bot className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">@{agent.handle}</div>
            <div className="text-xs text-muted-foreground">{agent.name}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function GroupChatView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingBlocks, setStreamingBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [mentionFilter, setMentionFilter] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingBlocks, scrollToBottom]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-conversations");
      if (!response.ok) throw new Error("Failed to load conversations");
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Load agents
  const loadAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/agents");
      if (!response.ok) throw new Error("Failed to load agents");
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Load messages for conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/admin-conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = await response.json();
      const messages = data.messages || [];
      
      // Sort messages by createdAt to ensure correct order
      // Backend should send ISO string format, but handle both formats
      const sortedMessages = [...messages].sort((a, b) => {
        const getTime = (msg: Message): number => {
          const ts = msg.createdAt;
          if (!ts) return 0;
          // ISO string format (preferred, from backend toJSON)
          if (typeof ts === 'string') {
            return new Date(ts).getTime();
          }
          // Firestore timestamp format: { seconds: number, nanoseconds?: number }
          if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
            return (ts.seconds as number) * 1000 + ((ts.nanoseconds as number) || 0) / 1000000;
          }
          // Date object
          if (ts instanceof Date) {
            return ts.getTime();
          }
          return 0;
        };
        
        return getTime(a) - getTime(b);
      });
      
      setMessages(sortedMessages);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadConversations(), loadAgents()]);
      setLoading(false);
    };
    init();
  }, [loadConversations, loadAgents]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, loadMessages]);

  // Create new conversation
  const createConversation = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" })
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      const data = await response.json();
      await loadConversations();
      setSelectedConversation(data.conversation.id);
    } catch (error) {
      console.error(error);
    }
  }, [loadConversations]);

  // Handle input change with mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Detect @ mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, []);

  // Handle mention selection
  const handleMentionSelect = useCallback((handle: string) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    
    // Find the @ position
    const atPos = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, atPos) + `@${handle} ` + textAfterCursor;
    
    setInput(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  }, [input]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    
    const messageText = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingBlocks([]);
    
    try {
      // Create conversation if needed
      let convId = selectedConversation;
      if (!convId) {
        const createResponse = await fetch("/api/admin-conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: messageText.slice(0, 50) })
        });
        if (!createResponse.ok) throw new Error("Failed to create conversation");
        const data = await createResponse.json();
        convId = data.conversation.id;
        setSelectedConversation(convId);
        await loadConversations();
      }
      
      // Stream the response
      const response = await fetch("/api/admin-streaming/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: messageText
        })
      });
      
      if (!response.ok || !response.body) {
        throw new Error("Stream failed");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const blocks: ContentBlock[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                // Find or create text block
                const lastTextBlock = blocks.find(b => 
                  b.type === 'text' && b.metadata.status === 'streaming'
                );
                if (lastTextBlock) {
                  lastTextBlock.data.text = (lastTextBlock.data.text || '') + (data.data?.text || '');
                } else {
                  blocks.push({
                    type: 'text',
                    data: { text: data.data?.text || '' },
                    metadata: {
                      sequence: data.metadata?.sequence || blocks.length,
                      status: 'streaming'
                    }
                  });
                }
              } else if (data.type === 'tool_use') {
                // Close any streaming text block
                const lastTextBlock = blocks.find(b => 
                  b.type === 'text' && b.metadata.status === 'streaming'
                );
                if (lastTextBlock) {
                  lastTextBlock.metadata.status = 'complete';
                }
                
                blocks.push({
                  type: 'tool_use',
                  data: {
                    id: data.data?.id,
                    name: data.data?.name,
                    input: data.data?.input
                  },
                  metadata: {
                    sequence: data.metadata?.sequence || blocks.length,
                    status: data.metadata?.status || 'tool_call',
                    groupId: data.metadata?.groupId
                  }
                });
              } else if (data.type === 'tool_result') {
                blocks.push({
                  type: 'tool_result',
                  data: {
                    id: data.data?.id,
                    name: data.data?.name,
                    content: data.data?.content,
                    isError: data.data?.isError
                  },
                  metadata: {
                    sequence: data.metadata?.sequence || blocks.length,
                    status: data.metadata?.status || 'complete',
                    groupId: data.metadata?.groupId
                  }
                });
              } else if (data.type === 'done') {
                // Mark all blocks complete
                blocks.forEach(b => {
                  if (b.metadata.status === 'streaming') {
                    b.metadata.status = 'complete';
                  }
                });
              }
              
              setStreamingBlocks([...blocks]);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // Reload messages
      if (convId) {
        await loadMessages(convId);
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
      setStreamingBlocks([]);
    }
  }, [input, isStreaming, selectedConversation, loadConversations, loadMessages]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setShowMentions(false);
    }
  }, [handleSend]);

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Conversation list */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Conversations</CardTitle>
              <Button size="icon" variant="ghost" onClick={createConversation}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground p-2">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm",
                      selectedConversation === conv.id 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedConversation(conv.id)}
                  >
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="text-xs opacity-70">
                      {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {selectedConversation 
                  ? conversations.find(c => c.id === selectedConversation)?.title || "Chat"
                  : "New Conversation"}
              </CardTitle>
            </div>
            {agents.length > 0 && (
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>Available agents:</span>
                {agents.slice(0, 3).map(agent => (
                  <Badge key={agent.id} variant="outline" className="text-xs">
                    @{agent.handle}
                  </Badge>
                ))}
                {agents.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{agents.length - 3} more
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          
          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Start a conversation</p>
                  <p className="text-sm mt-1">
                    Use @handle to mention specific agents
                  </p>
                </div>
              </div>
            )}
            
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.agentHandle && (
                    <div className="text-xs font-medium mb-1 opacity-70">
                      @{message.agentHandle}
                    </div>
                  )}
                  <MessageContent contents={message.contents} />
                </div>
              </div>
            ))}
            
            {/* Streaming message */}
            {isStreaming && streamingBlocks.length > 0 && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                  <MessageContent contents={streamingBlocks} />
                </div>
              </div>
            )}
            
            {isStreaming && streamingBlocks.length === 0 && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </CardContent>
          
          {/* Input */}
          <div className="p-4 border-t">
            <div className="relative">
              <MentionPopup
                agents={agents}
                filter={mentionFilter}
                onSelect={handleMentionSelect}
                visible={showMentions}
              />
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... Use @ to mention agents"
                  className="min-h-[60px] resize-none"
                  disabled={isStreaming}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isStreaming}
                  className="self-end"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}



