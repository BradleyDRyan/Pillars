import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResearchBlockProps {
  toolName: string;
  status?: 'pending' | 'running' | 'success' | 'error';
  subtitle?: string;
  metadata?: string[];
  request?: string | null;
  response?: React.ReactNode;
  wrapResponse?: boolean;
  defaultExpanded?: boolean;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'running':
      return 'text-blue-500';
    case 'success':
      return 'text-green-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'running':
      return 'Running...';
    case 'success':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return 'Pending';
  }
};

export default function ResearchBlock({
  toolName,
  status = 'pending',
  subtitle,
  metadata = [],
  request,
  response,
  wrapResponse = true,
  defaultExpanded = false
}: ResearchBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasContent = Boolean(request || response);

  return (
    <Card className="my-2 border-border">
      <CardHeader
        className={cn(
          "cursor-pointer select-none",
          "hover:bg-muted/50 transition-colors",
          "pb-2"
        )}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {toolName === 'search_amazon' ? 'A' : toolName === 'web_search' ? 'W' : 'T'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">
                {toolName.replace(/_/g, ' ')}
              </span>
              <span className={cn("text-xs", getStatusColor(status))}>
                {getStatusText(status)}
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
            {metadata.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {metadata.map((meta, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                  >
                    {meta}
                  </span>
                ))}
              </div>
            )}
          </div>
          {hasContent && (
            <div className="flex-shrink-0">
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      {expanded && hasContent && (
        <CardContent className="pt-0 pb-3">
          {request && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Request
              </div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {typeof request === 'string' ? request : JSON.stringify(request, null, 2)}
              </pre>
            </div>
          )}
          {response && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Response
              </div>
              {wrapResponse ? (
                <div className="bg-muted/50 p-2 rounded text-sm">
                  {response}
                </div>
              ) : (
                response
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}


