import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Bot, Pencil, Trash2 } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  handle: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model: string;
  speakMode: 'when_mentioned' | 'proactive';
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type Tool = {
  id: string;
  name: string;
  description: string;
};

type Status = {
  tone: "success" | "error" | "info";
  message: string;
};

type AgentFormState = {
  name: string;
  handle: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model: string;
  speakMode: 'when_mentioned' | 'proactive';
  isActive: boolean;
};

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-3-7-sonnet-20250219", label: "Claude Sonnet 3.7" },
  { value: "claude-3-5-sonnet-latest", label: "Claude Sonnet 3.5" }
];

const SPEAK_MODE_OPTIONS = [
  { value: "when_mentioned", label: "Only when @mentioned", description: "Agent only responds when explicitly mentioned" },
  { value: "proactive", label: "Proactive", description: "Agent can respond whenever it thinks it's appropriate" }
];

const defaultFormState = (): AgentFormState => ({
  name: "",
  handle: "",
  description: "",
  systemPrompt: "",
  tools: [],
  model: "claude-sonnet-4-20250514",
  speakMode: "when_mentioned",
  isActive: true
});

export function AgentView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(defaultFormState());
  const [saving, setSaving] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents");
      if (!response.ok) throw new Error("Failed to load agents");
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load agents"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTools = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/tools/available");
      if (!response.ok) throw new Error("Failed to load tools");
      const data = await response.json();
      setAvailableTools(data.tools || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadTools();
  }, [loadAgents, loadTools]);

  const handleDialogChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setForm(defaultFormState());
      setEditingAgentId(null);
    }
  }, []);

  const handleEdit = useCallback((agent: Agent) => {
    setForm({
      name: agent.name,
      handle: agent.handle,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      model: agent.model,
      speakMode: agent.speakMode || 'when_mentioned',
      isActive: agent.isActive
    });
    setEditingAgentId(agent.id);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete agent");
      
      setStatus({ tone: "success", message: "Agent deleted" });
      loadAgents();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to delete agent"
      });
    }
  }, [loadAgents]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.handle.trim()) {
      setStatus({ tone: "error", message: "Name and handle are required" });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const isEditing = Boolean(editingAgentId);
      const url = isEditing ? `/api/agents/${editingAgentId}` : "/api/agents";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          handle: form.handle.trim(),
          description: form.description.trim(),
          systemPrompt: form.systemPrompt.trim(),
          tools: form.tools,
          model: form.model,
          speakMode: form.speakMode,
          isActive: form.isActive
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} agent`);
      }

      setStatus({
        tone: "success",
        message: `Agent "${form.name}" ${isEditing ? "updated" : "created"}`
      });
      setDialogOpen(false);
      setForm(defaultFormState());
      setEditingAgentId(null);
      loadAgents();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save agent"
      });
    } finally {
      setSaving(false);
    }
  }, [form, editingAgentId, loadAgents]);

  const toggleTool = useCallback((toolId: string) => {
    setForm(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(t => t !== toolId)
        : [...prev.tools, toolId]
    }));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Create AI agents that can be invoked via @ mentions in group chat
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Bot className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgentId ? "Edit Agent" : "Create Agent"}</DialogTitle>
              <DialogDescription>
                {editingAgentId
                  ? "Update the agent configuration"
                  : "Create a new AI agent with custom tools and behavior"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input
                    id="agent-name"
                    placeholder="Content Manager"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-handle">Handle</Label>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">@</span>
                    <Input
                      id="agent-handle"
                      placeholder="content"
                      value={form.handle}
                      onChange={e => setForm(prev => ({ 
                        ...prev, 
                        handle: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')
                      }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for @ mentions (e.g., @{form.handle || "content"})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-description">Description</Label>
                <Input
                  id="agent-description"
                  placeholder="Helps manage pillars, themes, and principles"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-prompt">System Prompt</Label>
                <Textarea
                  id="agent-prompt"
                  placeholder="You are a helpful assistant that..."
                  value={form.systemPrompt}
                  onChange={e => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Custom instructions for this agent. Leave empty for default behavior.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tools</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {availableTools.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading tools...</p>
                  ) : (
                    availableTools.map(tool => (
                      <div key={tool.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={`tool-${tool.id}`}
                          checked={form.tools.includes(tool.id)}
                          onCheckedChange={() => toggleTool(tool.id)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={`tool-${tool.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {tool.name}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {form.tools.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {form.tools.length} tool{form.tools.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-model">Model</Label>
                <Select
                  value={form.model}
                  onValueChange={value => setForm(prev => ({ ...prev, model: value }))}
                >
                  <SelectTrigger id="agent-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-speak-mode">Speak Mode</Label>
                <Select
                  value={form.speakMode}
                  onValueChange={value => setForm(prev => ({ ...prev, speakMode: value as 'when_mentioned' | 'proactive' }))}
                >
                  <SelectTrigger id="agent-speak-mode">
                    <SelectValue placeholder="Select speak mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEAK_MODE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls when this agent can respond in conversations.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agent-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => 
                    setForm(prev => ({ ...prev, isActive: checked === true }))
                  }
                />
                <Label htmlFor="agent-active" className="cursor-pointer">
                  Active
                </Label>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : (editingAgentId ? "Update Agent" : "Create Agent")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {status && (
        <div
          className={cn(
            "px-4 py-3 text-sm rounded-md",
            status.tone === "success" && "bg-green-50 text-green-800",
            status.tone === "error" && "bg-red-50 text-red-800",
            status.tone === "info" && "bg-muted/60 text-muted-foreground"
          )}
        >
          {status.message}
        </div>
      )}

      <Card>
        <CardHeader className="px-4 py-5 sm:px-6">
          <CardTitle className="text-base font-semibold">All Agents</CardTitle>
          <CardDescription>
            Agents can be invoked via @ mentions in the group chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-sm text-muted-foreground">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No agents yet. Create your first agent to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant="outline">@{agent.handle}</Badge>
                        {agent.speakMode === 'proactive' && (
                          <Badge variant="default" className="bg-green-600">Proactive</Badge>
                        )}
                        {!agent.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {agent.description || "No description"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.tools.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No tools assigned</span>
                        ) : (
                          agent.tools.map(tool => (
                            <Badge key={tool} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(agent)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(agent.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

