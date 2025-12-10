import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

interface Agent {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  conversationId?: string | null;
  enableWebSearch: boolean;
  allowedTools?: string[];
  createdAt?: string;
  lastMessage?: string | null;
}

interface ToolDefinition {
  name: string;
  label: string;
  description: string;
}

interface AgentSettingsProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (agent: Agent) => void;
  onDelete: () => void;
  availableTools: ToolDefinition[];
}

export default function AgentSettings({
  agent,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  availableTools
}: AgentSettingsProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [instructions, setInstructions] = useState(agent.instructions);
  const [selectedTools, setSelectedTools] = useState<string[]>(agent.allowedTools || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(agent.name);
      setDescription(agent.description);
      setInstructions(agent.instructions);
      const tools = agent.allowedTools || [];
      setSelectedTools(tools);
    }
  }, [open, agent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tools = selectedTools;
      const enableWebSearchFlag = tools.includes('web_search');
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          instructions,
          enableWebSearch: enableWebSearchFlag,
          allowedTools: tools
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure all required fields are present
        onUpdate({
          ...data.agent,
          instructions: data.agent.instructions || '',
          conversationId: data.agent.conversationId || null,
          createdAt: data.agent.createdAt || new Date().toISOString()
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent Settings</DialogTitle>
          <DialogDescription>
            Edit agent name, description, instructions, and settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-instructions">Instructions</Label>
            <Textarea
              id="settings-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              These instructions guide the agent's behavior. Edit carefully.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tools</Label>
            <p className="text-xs text-muted-foreground">
              Enable or disable specific capabilities for this agent.
            </p>
            <div className="space-y-3">
              {availableTools.length === 0 && (
                <p className="text-xs text-muted-foreground">No tools available.</p>
              )}
              {availableTools.map((tool) => {
                const checked = selectedTools.includes(tool.name);
                return (
                  <div key={tool.name} className="flex items-start gap-3">
                    <Checkbox
                      id={`settings-tool-${tool.name}`}
                      checked={checked}
                      onCheckedChange={(state: boolean | 'indeterminate') => {
                        const isChecked = state === true;
                        setSelectedTools((prev) => {
                          if (isChecked) {
                            if (prev.includes(tool.name)) {
                              return prev;
                            }
                            return [...prev, tool.name];
                          }
                          return prev.filter((name) => name !== tool.name);
                        });
                      }}
                    />
                    <div className="space-y-1">
                      <Label htmlFor={`settings-tool-${tool.name}`} className="cursor-pointer">
                        {tool.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="destructive" onClick={onDelete}>
            Delete Agent
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

