import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Textarea } from './ui/textarea';
import { Play, Settings, Trash2, Send } from 'lucide-react';
import AgentSettings from './AgentSettings';
import MessageContent from './MessageContent';
import { Block } from '../utils/blockTypes';

interface Agent {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  enableWebSearch?: boolean;
  allowedTools?: string[];
  conversationId: string | null;
}

interface ToolDefinition {
  name: string;
  label: string;
  description: string;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  role: string;
  createdAt: string;
  blocks?: Block[];
}


interface AgentConversationProps {
  agent: Agent;
  onRun?: () => void; // Optional, handled internally now
  onDelete: () => void;
  onStreamingChange?: (isStreaming: boolean) => void; // Callback when streaming starts/stops
  onUpdate?: (agent: Agent) => void; // Callback when agent is updated
  availableTools: ToolDefinition[];
}

export default function AgentConversation({
  agent,
  onDelete,
  onStreamingChange,
  onUpdate,
  availableTools
}: AgentConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (agent.conversationId) {
      loadConversation();
    } else {
      setLoading(false);
    }
  }, [agent.conversationId]);

  const loadConversation = async () => {
    if (!agent.conversationId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agent.id}/conversation`);
      
      if (!response.ok) {
        // If response is not OK, try to get error message
        let errorMessage = `Server returned ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse error, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Set empty messages array on error so UI doesn't break
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setStreamingContent('');
    setStreamingMessageId(null);

    // Notify parent that streaming has started
    if (onStreamingChange) {
      onStreamingChange(true);
    }

    let cleanupCalled = false;
    const finishStreaming = (options: { reload?: boolean } = {}) => {
      if (cleanupCalled) {
        return;
      }
      cleanupCalled = true;
      setRunning(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      if (onStreamingChange) {
        onStreamingChange(false);
      }
      if (options.reload) {
        loadConversation();
      }
    };

    try {
      // Use streaming endpoint
      const response = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stream: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to start agent run');
      }

      // Handle Server-Sent Events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let currentMessageId: string | null = null;
      let receivedComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        
        // Process any remaining buffer before exiting
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'complete' || data.type === 'error') {
                    receivedComplete = true;
                  }
                } catch (e) {
                  // Ignore parse errors for final buffer
                }
              }
            }
          }

          // If we didn't receive a complete event, ensure we clean up
          if (!receivedComplete) {
            finishStreaming({ reload: true });
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                currentMessageId = data.messageId;
                setStreamingMessageId(data.messageId);
                // Add placeholder message to the list
                setMessages(prev => [...prev, {
                  id: data.messageId,
                  sender: agent.id,
                  content: '',
                  role: 'assistant',
                  createdAt: new Date().toISOString(),
                  blocks: []
                }]);
              } else if (data.type === 'text') {
                // Text delta from stream coordinator
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.id === currentMessageId) {
                      const currentContent = msg.content || '';
                      return { 
                        ...msg, 
                        content: currentContent + (data.content || ''),
                        blocks: msg.blocks || []
                      };
                    }
                    return msg;
                  })
                );
                setStreamingContent(prev => prev + (data.content || ''));
              } else if (data.type === 'chunk') {
                // Legacy chunk event (backward compatibility)
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.id === currentMessageId) {
                      return { ...msg, content: (msg.content || '') + data.content };
                    }
                    return msg;
                  })
                );
                setStreamingContent(prev => prev + data.content);
              } else if (data.type === 'tool_call') {
                // Tool call event - add tool_use block
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.id === currentMessageId) {
                      const existingBlocks = msg.blocks || [];
                      const newBlock = {
                        type: 'tool_use',
                        data: {
                          id: data.data?.id,
                          name: data.data?.name,
                          input: data.data?.input || {}
                        },
                        metadata: {
                          status: 'running',
                          sequence: existingBlocks.length
                        },
                        key: `tool-${data.data?.id || Date.now()}`
                      };
                      return {
                        ...msg,
                        blocks: [...existingBlocks, newBlock]
                      };
                    }
                    return msg;
                  })
                );
              } else if (data.type === 'tool_result') {
                // Tool result event - update corresponding tool_use block
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.id === currentMessageId) {
                      const existingBlocks = msg.blocks || [];
                      const toolUseId = data.data?.id;
                      const updatedBlocks = existingBlocks.map((block: any) => {
                        if (block.type === 'tool_use' && block.data?.id === toolUseId) {
                          // Update the tool_use block with result
                          return {
                            ...block,
                            metadata: {
                              ...block.metadata,
                              status: data.data?.isError ? 'error' : 'complete'
                            },
                            resultBlocks: [{
                              type: 'tool_result',
                              data: {
                                id: toolUseId,
                                name: data.data?.name,
                                content: data.data?.content,
                                isError: data.data?.isError || false
                              },
                              metadata: {
                                status: data.data?.isError ? 'tool_error' : 'tool_result'
                              }
                            }]
                          };
                        }
                        return block;
                      });
                      return {
                        ...msg,
                        blocks: updatedBlocks
                      };
                    }
                    return msg;
                  })
                );
              } else if (data.type === 'complete') {
                receivedComplete = true;
                finishStreaming({ reload: true });
                try {
                  await reader.cancel();
                } catch {
                  // Ignore cancel errors
                }
                return;
              } else if (data.type === 'error') {
                receivedComplete = true;
                finishStreaming({ reload: true });
                console.error('Agent run error:', data.error);
                try {
                  await reader.cancel();
                } catch {
                  // Ignore cancel errors
                }
                return;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to run agent:', error);
      finishStreaming({ reload: true });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const canSendMessage = Boolean(
    agent.conversationId &&
    composerValue.trim() &&
    !sending &&
    !running
  );

  const handleSendMessage = async () => {
    if (!agent.conversationId || !composerValue.trim() || sending || running) {
      return;
    }

    const content = composerValue.trim();
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender: 'user',
      content,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setComposerValue('');
    setSending(true);

    try {
      const response = await fetch(`/api/agents/${agent.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          role: 'user',
          type: 'text'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const savedMessage = await response.json();
      setMessages(prev =>
        prev.map(msg => (msg.id === optimisticId ? savedMessage : msg))
      );

      handleRun();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      setComposerValue(content);
    } finally {
      setSending(false);
    }
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSendMessage) {
      handleSendMessage();
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSendMessage) {
        handleSendMessage();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRun}
              disabled={running}
            >
              <Play className="mr-2 h-4 w-4" />
              {running ? 'Running...' : 'Run Agent'}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <p className="text-muted-foreground">No messages yet. Run the agent to get started.</p>
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => {
              const isAgent = message.sender === agent.id;
              const displayContent = message.id === streamingMessageId ? streamingContent : message.content;
              const isStreaming = message.id === streamingMessageId && running;

              return (
                <div
                  key={message.id}
                  className={`flex ${isAgent ? 'justify-start' : 'justify-end'} w-full max-w-[80%]`}
                >
                  <Card className={`${isAgent ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                    <CardContent className="p-4">
                      <div className="text-xs font-medium mb-1 opacity-70">
                        {isAgent ? agent.name : 'You'}
                      </div>
                      {isAgent ? (
                        <MessageContent
                          messageId={message.id}
                          blocks={message.blocks}
                          content={displayContent}
                          isStreaming={isStreaming}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap">{displayContent}</div>
                      )}
                      <div className="text-xs opacity-60 mt-2">
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-card/80 p-4 shrink-0">
        <form onSubmit={handleComposerSubmit} className="max-w-4xl mx-auto space-y-2">
          <Textarea
            value={composerValue}
            onChange={(event) => setComposerValue(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={agent.conversationId ? 'Send a message...' : 'Conversation not ready yet.'}
            disabled={!agent.conversationId || sending || running}
            rows={3}
            className="min-h-[64px] max-h-48 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Shift + Enter for newline. Agent replies automatically.
            </span>
            <Button type="submit" disabled={!canSendMessage}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Sending...' : running ? 'Waiting...' : 'Send'}
            </Button>
          </div>
        </form>
      </div>

      {/* Settings Dialog */}
      <AgentSettings
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description,
          instructions: agent.instructions || '',
          enableWebSearch: agent.enableWebSearch || false,
          allowedTools: agent.allowedTools || []
        }}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        availableTools={availableTools}
        onUpdate={(updated) => {
          if (onUpdate) {
            // Merge updated agent with existing agent data
            onUpdate({ ...agent, ...updated });
          }
          // Reload conversation if agent was updated
          if (agent.conversationId) {
            loadConversation();
          }
        }}
        onDelete={() => {
          onDelete();
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

