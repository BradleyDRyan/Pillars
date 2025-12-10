import { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import AgentConversation from './components/AgentConversation';
import AgentSettings from './components/AgentSettings';
import AgentSidebar from './components/AgentSidebar';

interface Agent {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  conversationId: string | null;
  enableWebSearch: boolean;
  allowedTools?: string[];
  createdAt: string;
  lastMessage?: string | null;
}

interface ToolDefinition {
  name: string;
  label: string;
  description: string;
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [selectedCreateTools, setSelectedCreateTools] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [availableTools, setAvailableTools] = useState<ToolDefinition[]>([]);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    loadAvailableTools();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      
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
      const agentsWithMessages = await Promise.all(
        (data.agents || []).map(async (agent: Agent) => {
          if (agent.conversationId) {
            try {
              const convResponse = await fetch(`/api/agents/${agent.id}/conversation`);
              if (convResponse.ok) {
                const convData = await convResponse.json();
                return {
                  ...agent,
                  lastMessage: convData.conversation?.lastMessage || null
                };
              }
            } catch {
              // If conversation fetch fails, just return agent without lastMessage
            }
          }
          return agent;
        })
      );
      setAgents(agentsWithMessages);
    } catch (error) {
      console.error('Failed to load agents:', error);
      // Set empty array on error so UI doesn't break
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTools = async () => {
    try {
      const response = await fetch('/api/agents/tools');
      if (!response.ok) {
        throw new Error('Failed to load tools');
      }
      const data = await response.json();
      setAvailableTools(data.tools || []);
    } catch (error) {
      console.error('Failed to load tools:', error);
      setAvailableTools([
        {
          name: 'web_search',
          label: 'Web Search',
          description: 'Search the web for up-to-date information.'
        }
      ]);
    }
  };

  const createAgent = async () => {
    if (!newAgentName.trim() || !newAgentDescription.trim()) {
      setCreateError('Please fill in both name and description');
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          description: newAgentDescription.trim(),
          enableWebSearch: selectedCreateTools.includes('web_search'),
          allowedTools: selectedCreateTools
        })
      });

      if (!response.ok) {
        let errorMessage = `Failed to create agent: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        setCreateError(errorMessage);
        setIsCreating(false);
        return;
      }

      const data = await response.json();
      setNewAgentName('');
      setNewAgentDescription('');
      setSelectedCreateTools([]);
      setCreateError(null);
      setCreateDialogOpen(false);
      setIsCreating(false);
      
      // Reload agents to ensure we have the latest data
      await loadAgents();
      
      // Select the newly created agent
      if (data.agent) {
        setSelectedAgent(data.agent);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create agent. Please try again.');
      setIsCreating(false);
    }
  };

  const runAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: 'POST'
      });

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

      // For streaming requests, we don't need to parse JSON
      // The AgentConversation component handles streaming directly
      // For non-streaming, parse the response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        // Reload agents to get updated conversation
        loadAgents();
        if (selectedAgent?.id === agentId) {
          // Reload conversation view
          setSelectedAgent({ ...selectedAgent, conversationId: data.conversation?.id });
        }
      }
    } catch (error) {
      console.error('Failed to run agent:', error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAgents(agents.filter(a => a.id !== agentId));
        if (selectedAgent?.id === agentId) {
          setSelectedAgent(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 shrink-0">
        <AgentSidebar
          agents={agents}
          selectedAgentId={selectedAgent?.id || null}
          streamingAgentId={streamingAgentId}
          onSelectAgent={(agent) => {
            // Clear streaming state if switching to a different agent
            if (streamingAgentId && streamingAgentId !== agent.id) {
              setStreamingAgentId(null);
            }
            setSelectedAgent(agent);
          }}
          onCreateAgent={() => setCreateDialogOpen(true)}
          onRunAgent={(agentId, e) => {
            e.stopPropagation();
            runAgent(agentId);
          }}
          onSettingsAgent={(agent, e) => {
            e.stopPropagation();
            setSelectedAgent(agent);
            setSettingsDialogOpen(true);
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedAgent ? (
          <AgentConversation
            agent={selectedAgent}
            availableTools={availableTools}
            onRun={() => runAgent(selectedAgent.id)}
            onDelete={() => deleteAgent(selectedAgent.id)}
            onStreamingChange={(isStreaming) => {
              setStreamingAgentId(isStreaming ? selectedAgent.id : null);
            }}
            onUpdate={(updated: any) => {
              const fullAgent: Agent = {
                ...updated,
                instructions: updated.instructions || '',
                conversationId: updated.conversationId || null,
                enableWebSearch: updated.enableWebSearch ?? false,
                allowedTools: updated.allowedTools || [],
                createdAt: updated.createdAt || new Date().toISOString(),
                lastMessage: updated.lastMessage || null
              };
              setAgents(agents.map(a => a.id === fullAgent.id ? fullAgent : a));
              setSelectedAgent(fullAgent);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Select an agent</h2>
              <p className="text-muted-foreground">Choose an agent from the sidebar to view its conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setCreateError(null);
          setNewAgentName('');
          setNewAgentDescription('');
          setSelectedCreateTools([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Describe what you want the agent to do. Instructions will be auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {createError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Deal Finder"
                value={newAgentName}
                onChange={(e) => {
                  setNewAgentName(e.target.value);
                  setCreateError(null);
                }}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="e.g., Find me the best deals on the Nuna X stroller"
                value={newAgentDescription}
                onChange={(e) => {
                  setNewAgentDescription(e.target.value);
                  setCreateError(null);
                }}
                rows={4}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label>Tools</Label>
              <p className="text-xs text-muted-foreground">
                Select which tools this agent can use.
              </p>
              <div className="space-y-3">
                {availableTools.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tools available.</p>
                )}
                {availableTools.map((tool) => {
                  const checked = selectedCreateTools.includes(tool.name);
                  return (
                    <div key={tool.name} className="flex items-start gap-3">
                      <Checkbox
                        id={`create-tool-${tool.name}`}
                        checked={checked}
                        onCheckedChange={(state: boolean | 'indeterminate') => {
                          const isChecked = state === true;
                          setSelectedCreateTools((prev) => {
                            if (isChecked) {
                              if (prev.includes(tool.name)) {
                                return prev;
                              }
                              return [...prev, tool.name];
                            }
                            return prev.filter((name) => name !== tool.name);
                          });
                        }}
                        disabled={isCreating}
                      />
                      <div className="space-y-1">
                        <Label htmlFor={`create-tool-${tool.name}`} className="cursor-pointer">
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
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCreateDialogOpen(false);
                setCreateError(null);
                setNewAgentName('');
                setNewAgentDescription('');
                setSelectedCreateTools([]);
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createAgent} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      {selectedAgent && (
        <AgentSettings
          agent={selectedAgent}
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          availableTools={availableTools}
          onUpdate={(updated: any) => {
            const fullAgent: Agent = {
              ...updated,
              instructions: updated.instructions || '',
              conversationId: updated.conversationId || null,
              enableWebSearch: updated.enableWebSearch ?? false,
              allowedTools: updated.allowedTools || [],
              createdAt: updated.createdAt || new Date().toISOString(),
              lastMessage: updated.lastMessage || null
            };
            setAgents(agents.map(a => a.id === fullAgent.id ? fullAgent : a));
            setSelectedAgent(fullAgent);
          }}
          onDelete={() => {
            deleteAgent(selectedAgent.id);
            setSettingsDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;

