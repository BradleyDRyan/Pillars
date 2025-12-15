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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { 
  Bot, 
  Check, 
  Loader2, 
  MessageSquare, 
  Plus, 
  Send, 
  AlertCircle, 
  Wrench,
  Users,
  FileText,
  X,
  Settings
} from "lucide-react";

// Types
type Agent = {
  id: string;
  name: string;
  handle: string;
  description: string;
  speakMode: string;
  isActive: boolean;
};

type Room = {
  id: string;
  name: string;
  description: string;
  memberAgentIds: string[];
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type RoomMessage = {
  id: string;
  roomId: string;
  senderType: 'user' | 'agent';
  senderId: string;
  senderHandle: string | null;
  senderName: string | null;
  content: string;
  mentions: string[];
  draftRefs: { agentId: string; draftId: string }[];
  createdAt: string;
};

type Draft = {
  id: string;
  agentId: string;
  contentType: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  createdAt: string;
  agent?: { id: string; name: string; handle: string };
};

// Markdown component
function Markdown({ children }: { children: string }) {
  const html = children
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br />');
  
  return (
    <div 
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
}

// Mention popup
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

// Create Room Dialog
function CreateRoomDialog({ 
  agents, 
  onCreated 
}: { 
  agents: Agent[]; 
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          memberAgentIds: selectedAgents
        })
      });

      if (!response.ok) throw new Error("Failed to create room");

      setOpen(false);
      setName("");
      setDescription("");
      setSelectedAgents([]);
      onCreated();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
          <DialogDescription>
            Create a new group chat room and add agents
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              placeholder="Content Team"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-description">Description</Label>
            <Input
              id="room-description"
              placeholder="Drafting onboarding content"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Add Agents</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents available</p>
              ) : (
                agents.filter(a => a.isActive).map(agent => (
                  <div key={agent.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`agent-${agent.id}`}
                      checked={selectedAgents.includes(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <label
                      htmlFor={`agent-${agent.id}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">@{agent.handle}</span>
                      <span className="text-xs text-muted-foreground">{agent.name}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Room Members Panel
function RoomMembersPanel({
  room,
  agents,
  onAddAgent,
  onRemoveAgent
}: {
  room: Room;
  agents: Agent[];
  onAddAgent: (agentId: string) => void;
  onRemoveAgent: (agentId: string) => void;
}) {
  const memberAgents = agents.filter(a => room.memberAgentIds.includes(a.id));
  const availableAgents = agents.filter(a => a.isActive && !room.memberAgentIds.includes(a.id));

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Members ({memberAgents.length})
        </h4>
        <div className="space-y-1">
          {memberAgents.map(agent => (
            <div key={agent.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">@{agent.handle}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onRemoveAgent(agent.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {memberAgents.length === 0 && (
            <p className="text-xs text-muted-foreground">No agents in this room</p>
          )}
        </div>
      </div>

      {availableAgents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Add Agent</h4>
          <div className="space-y-1">
            {availableAgents.map(agent => (
              <button
                key={agent.id}
                type="button"
                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left"
                onClick={() => onAddAgent(agent.id)}
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">@{agent.handle}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Drafts Panel
function DraftsPanel({ roomId }: { roomId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/drafts?status=draft`);
      if (!response.ok) throw new Error("Failed to load drafts");
      const data = await response.json();
      setDrafts(data.drafts || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleApprove = async (agentId: string, draftId: string) => {
    try {
      await fetch(`/api/agent-drafts/${agentId}/${draftId}/approve`, {
        method: "POST"
      });
      loadDrafts();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading drafts...</div>;
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-4">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No pending drafts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Drafts ({drafts.length})
      </h4>
      {drafts.map(draft => (
        <div key={draft.id} className="p-3 rounded-md border bg-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">{draft.title}</div>
              <div className="text-xs text-muted-foreground">
                by @{draft.agent?.handle || 'unknown'} • {draft.contentType}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleApprove(draft.agentId, draft.id)}
            >
              <Check className="h-3 w-3 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroupChatView() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mentionFilter, setMentionFilter] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to load rooms");
      const data = await response.json();
      setRooms(data.rooms || []);
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

  // Load messages for room
  const loadMessages = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadRooms(), loadAgents()]);
      setLoading(false);
    };
    init();
  }, [loadRooms, loadAgents]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
    } else {
      setMessages([]);
    }
  }, [selectedRoom, loadMessages]);

  // Select room
  const selectRoom = async (roomId: string) => {
    const response = await fetch(`/api/rooms/${roomId}`);
    if (response.ok) {
      const data = await response.json();
      setSelectedRoom(data.room);
    }
  };

  // Add agent to room
  const handleAddAgent = async (agentId: string) => {
    if (!selectedRoom) return;
    try {
      await fetch(`/api/rooms/${selectedRoom.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId })
      });
      await selectRoom(selectedRoom.id);
    } catch (error) {
      console.error(error);
    }
  };

  // Remove agent from room
  const handleRemoveAgent = async (agentId: string) => {
    if (!selectedRoom) return;
    try {
      await fetch(`/api/rooms/${selectedRoom.id}/members/${agentId}`, {
        method: "DELETE"
      });
      await selectRoom(selectedRoom.id);
    } catch (error) {
      console.error(error);
    }
  };

  // Handle input change with mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
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
    
    const atPos = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, atPos) + `@${handle} ` + textAfterCursor;
    
    setInput(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  }, [input]);

  // Send message with streaming
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !selectedRoom) return;
    
    const messageText = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingText(new Map());
    
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText })
      });
      
      if (!response.ok || !response.body) {
        throw new Error("Stream failed");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const agentTexts = new Map<string, string>();
      
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
              
              if (data.type === 'text' && data.data?.agentHandle) {
                const handle = data.data.agentHandle;
                const current = agentTexts.get(handle) || "";
                agentTexts.set(handle, current + (data.data.text || ""));
                setStreamingText(new Map(agentTexts));
              } else if (data.type === 'agent_start') {
                agentTexts.set(data.data.handle, "");
                setStreamingText(new Map(agentTexts));
              } else if (data.type === 'agent_end' || data.type === 'done') {
                // Reload messages when done
                await loadMessages(selectedRoom.id);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
      setStreamingText(new Map());
      // Final reload
      if (selectedRoom) {
        await loadMessages(selectedRoom.id);
      }
    }
  }, [input, isStreaming, selectedRoom, loadMessages]);

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

  // Get member agents for selected room
  const memberAgents = selectedRoom 
    ? agents.filter(a => selectedRoom.memberAgentIds.includes(a.id))
    : [];

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Room list */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Rooms</CardTitle>
              <CreateRoomDialog agents={agents} onCreated={loadRooms} />
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground p-2">Loading...</div>
            ) : rooms.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No rooms yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-1">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm",
                      selectedRoom?.id === room.id 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => selectRoom(room.id)}
                  >
                    <div className="font-medium truncate">{room.name}</div>
                    <div className="text-xs opacity-70 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {room.memberAgentIds.length} agents
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  {selectedRoom?.name || "Select a room"}
                </CardTitle>
              </div>
              {selectedRoom && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
            {memberAgents.length > 0 && (
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>Agents:</span>
                {memberAgents.slice(0, 4).map(agent => (
                  <Badge key={agent.id} variant="outline" className="text-xs">
                    @{agent.handle}
                  </Badge>
                ))}
                {memberAgents.length > 4 && (
                  <span className="text-xs text-muted-foreground">
                    +{memberAgents.length - 4} more
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedRoom ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Select or create a room</p>
                  </div>
                </div>
              ) : messages.length === 0 && !isStreaming ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Start the conversation</p>
                    <p className="text-sm mt-1">
                      Use @handle to mention agents
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.senderType === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.senderType === "agent" && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-3",
                          message.senderType === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {message.senderHandle && (
                          <div className="text-xs font-medium mb-1 opacity-70">
                            @{message.senderHandle}
                          </div>
                        )}
                        <Markdown>{message.content}</Markdown>
                        {message.draftRefs && message.draftRefs.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs opacity-70">
                            <FileText className="h-3 w-3" />
                            {message.draftRefs.length} draft{message.draftRefs.length !== 1 ? 's' : ''} created
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Streaming messages */}
                  {Array.from(streamingText.entries()).map(([handle, text]) => (
                    <div key={handle} className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                        <div className="text-xs font-medium mb-1 opacity-70">
                          @{handle}
                        </div>
                        {text ? (
                          <Markdown>{text}</Markdown>
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              <div ref={messagesEndRef} />
            </CardContent>
            
            {/* Right sidebar */}
            {selectedRoom && showSidebar && (
              <div className="w-64 border-l p-4 overflow-y-auto space-y-6">
                <RoomMembersPanel
                  room={selectedRoom}
                  agents={agents}
                  onAddAgent={handleAddAgent}
                  onRemoveAgent={handleRemoveAgent}
                />
                <DraftsPanel roomId={selectedRoom.id} />
              </div>
            )}
          </div>
          
          {/* Input */}
          {selectedRoom && (
            <div className="p-4 border-t">
              <div className="relative">
                <MentionPopup
                  agents={memberAgents}
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
          )}
        </Card>
      </div>
    </div>
  );
}

