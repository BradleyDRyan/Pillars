import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type MonitorSummary = {
  id: string
  name: string
  type?: string
  instructions: string
  model?: string | null
  enableWebSearch: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

type Assignment = {
  id: string
  monitorId: string
  personId: string
  userId?: string | null
  status: string
  runCount: number
  lastRunAt: string | null
  lastResult?: {
    eventId?: string
    type?: string
    description?: string
    importance?: number
    occurredAt?: string
    message?: string
  } | null
  lastError?: string | null
  monitor: MonitorSummary | null
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

export type ScheduledTrigger = {
  id: string
  monitorId: string
  schedule: string
  enabled: boolean
  createdAt?: string | null
  updatedAt?: string | null
  assignment?: Assignment
}

type TriggersColumnMeta = {
  onEdit: (triggerId: string) => void
  onDelete: (triggerId: string) => void
  assignments: Assignment[]
}

export const columns: ColumnDef<ScheduledTrigger>[] = [
  {
    accessorKey: "monitorId",
    id: "monitor",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monitor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta as TriggersColumnMeta | undefined
      const trigger = row.original
      const assignment = meta?.assignments.find(a => a.id === trigger.monitorId)
      const monitor = assignment?.monitor

      return <div className="font-medium">{monitor?.name ?? "Unknown monitor"}</div>
    },
    sortingFn: (rowA, rowB) => {
      const metaA = (rowA.original as ScheduledTrigger).assignment?.monitor?.name || ""
      const metaB = (rowB.original as ScheduledTrigger).assignment?.monitor?.name || ""
      return metaA.localeCompare(metaB)
    },
  },
  {
    accessorKey: "person",
    id: "person",
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
    cell: ({ row, table }) => {
      const meta = table.options.meta as TriggersColumnMeta | undefined
      const trigger = row.original
      const assignment = meta?.assignments.find(a => a.id === trigger.monitorId)
      const person = assignment?.person

      const personLabel = person
        ? person.relationship
          ? `${person.name} — ${person.relationship}`
          : person.name
        : "Unknown person"

      return <div>{personLabel}</div>
    },
    sortingFn: (rowA, rowB) => {
      const personA = (rowA.original as ScheduledTrigger).assignment?.person?.name || ""
      const personB = (rowB.original as ScheduledTrigger).assignment?.person?.name || ""
      return personA.localeCompare(personB)
    },
  },
  {
    accessorKey: "schedule",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Schedule
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div>{row.getValue("schedule")}</div>
    },
  },
  {
    accessorKey: "enabled",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Enabled
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const enabled = row.getValue("enabled") as boolean
      return (
        <Badge variant={enabled ? "success" : "secondary"}>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row, table }) => {
      const trigger = row.original
      const meta = table.options.meta as TriggersColumnMeta | undefined

      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => meta?.onEdit(trigger.id)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => meta?.onDelete(trigger.id)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
