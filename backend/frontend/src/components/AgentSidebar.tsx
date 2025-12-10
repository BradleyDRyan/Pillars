import { Button } from './ui/button';
import { Plus, MessageSquare, Settings, Play, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

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

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  streamingAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  onCreateAgent: () => void;
  onRunAgent: (agentId: string, e: React.MouseEvent) => void;
  onSettingsAgent: (agent: Agent, e: React.MouseEvent) => void;
}

export default function AgentSidebar({
  agents,
  selectedAgentId,
  streamingAgentId,
  onSelectAgent,
  onCreateAgent,
  onRunAgent,
  onSettingsAgent
}: AgentSidebarProps) {
  return (
    <div className="flex flex-col h-screen border-r bg-card">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Agents</h2>
          <Button size="sm" onClick={onCreateAgent}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No agents yet</p>
            <Button size="sm" onClick={onCreateAgent}>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedAgentId === agent.id && "bg-muted"
                )}
                onClick={() => onSelectAgent(agent)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                      {streamingAgentId === agent.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                      )}
                      {(agent.allowedTools?.includes('web_search') || agent.enableWebSearch) && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {agent.description}
                    </p>
                    {agent.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.lastMessage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => onSettingsAgent(agent, e)}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => onRunAgent(agent.id, e)}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

