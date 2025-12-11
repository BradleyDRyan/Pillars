"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Monitor = {
  id: string
  monitorId: string
  personId: string
  userId?: string | null
  status: string
  runCount: number
  lastRunAt: string | null
  lastResult?: any
  lastError?: string | null
  monitor: {
    id: string
    name: string
    type?: string
    instructions: string
    model?: string | null
    enableWebSearch: boolean
  } | null
  person?: {
    id: string
    userId?: string
    name: string
    relationship?: string
    sharedInterests?: string[]
    importantDates?: Array<{
      type: string
      date: string
      label: string
    }>
  } | null
}

export const createMonitorsColumns = (
  onEdit: (assignment: Monitor) => void,
  onDelete: (monitorId: string) => void,
  onRun: (assignmentId: string) => void,
  runningMonitors: Set<string>
): ColumnDef<Monitor>[] => [
  {
    id: "monitorName",
    accessorKey: "monitor.name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monitor Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const monitor = row.original.monitor
      return (
        <div>
          <div className="font-medium">{monitor?.name || "Unknown"}</div>
          <div className="text-xs text-muted-foreground">
            {monitor?.type === "shared_interest" ? "Shared Interest" : "Event"}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "person.name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Person
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const person = row.original.person
      return (
        <div>
          <div className="font-medium">{person?.name || "Unknown"}</div>
          {person?.relationship && (
            <div className="text-xs text-muted-foreground">{person.relationship}</div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const runCount = row.original.runCount

      let variant: "default" | "secondary" | "destructive" | "outline" = "secondary"
      if (status === "running") variant = "default"
      if (status === "error") variant = "destructive"

      return (
        <div>
          <Badge variant={variant}>
            {status}
          </Badge>
          <div className="text-xs text-muted-foreground mt-1">
            {runCount} run{runCount !== 1 ? "s" : ""}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "lastResult",
    header: "Last Result",
    cell: ({ row }) => {
      const lastResult = row.original.lastResult
      const lastError = row.original.lastError

      if (lastError) {
        return (
          <div className="text-xs text-destructive">
            Error: {lastError.substring(0, 50)}...
          </div>
        )
      }

      if (lastResult?.type === "no_update") {
        return (
          <div className="text-xs text-muted-foreground">
            No update
          </div>
        )
      }

      if (lastResult?.type) {
        return (
          <div className="text-xs">
            <div className="font-medium">{lastResult.type}</div>
            {lastResult.importance && (
              <div className="text-muted-foreground">
                Importance: {lastResult.importance}/100
              </div>
            )}
          </div>
        )
      }

      return <div className="text-xs text-muted-foreground">-</div>
    },
  },
  {
    accessorKey: "lastRunAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Run
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const lastRunAt = row.getValue("lastRunAt") as string | null
      if (!lastRunAt) return <div className="text-xs text-muted-foreground">Never</div>

      const date = new Date(lastRunAt)
      return (
        <div className="text-xs">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const assignment = row.original
      const isRunning = runningMonitors.has(assignment.id)

      return (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRun(assignment.id)}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "Run"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(assignment)}>
                Edit monitor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => assignment.monitor?.id && onDelete(assignment.monitor.id)}
                className="text-destructive"
              >
                Delete monitor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
