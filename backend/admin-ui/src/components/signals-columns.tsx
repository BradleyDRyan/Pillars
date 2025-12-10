import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export type Signal = {
  id: string
  userId: string | null
  personId: string | null
  monitorId: string | null
  type: string
  source: string
  description: string
  importance: number
  occurredAt: string | null
  createdAt: string | null
  metadata: {
    monitorName?: string
    model?: string | null
    runStartedAt?: string
    rawAiOutput?: string
  }
}

type SignalsColumnMeta = {
  formatTimestamp: (value: string | null | undefined) => string
}

export const columns: ColumnDef<Signal>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("type") || "Untitled signal"}</div>
    },
  },
  {
    accessorKey: "metadata",
    id: "person_monitor",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Person/Monitor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const metadata = row.getValue("person_monitor") as Signal["metadata"]
      return (
        <div className="text-sm">
          {metadata.monitorName || "-"}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      const monitorA = (rowA.getValue("person_monitor") as Signal["metadata"]).monitorName || ""
      const monitorB = (rowB.getValue("person_monitor") as Signal["metadata"]).monitorName || ""
      return monitorA.localeCompare(monitorB)
    },
  },
  {
    accessorKey: "importance",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Importance
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const importance = row.getValue("importance") as number | undefined
      return (
        <div>
          {typeof importance === "number" ? (
            <span className="text-sm font-medium">{importance}/100</span>
          ) : (
            "-"
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "occurredAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Occurred At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row, table }) => {
      const signal = row.original
      const meta = table.options.meta as SignalsColumnMeta | undefined
      const formatTimestamp = meta?.formatTimestamp || ((val: string | null | undefined) => val ? new Date(val).toLocaleString() : "Never")

      return (
        <div className="text-sm">
          {formatTimestamp(signal.occurredAt)}
        </div>
      )
    },
  },
]
