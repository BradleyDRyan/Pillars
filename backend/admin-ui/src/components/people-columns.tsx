import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Person = {
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
}

type PeopleColumnMeta = {
  onEdit: (personId: string) => void
  onDelete: (personId: string) => void
}

export const columns: ColumnDef<Person>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("name")}</div>
    },
  },
  {
    accessorKey: "relationship",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Relationship
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div>{row.getValue("relationship") || "-"}</div>
    },
  },
  {
    accessorKey: "sharedInterests",
    header: "Shared Interests",
    cell: ({ row }) => {
      const interests = row.getValue("sharedInterests") as string[] | undefined
      if (!interests || interests.length === 0) {
        return <div>-</div>
      }
      return <div>{interests.join(", ")}</div>
    },
  },
  {
    accessorKey: "importantDates",
    header: "Important Dates",
    cell: ({ row }) => {
      const dates = row.getValue("importantDates") as Array<{
        type: string
        date: string
        label: string
      }> | undefined

      if (!dates || dates.length === 0) {
        return <div>-</div>
      }

      return (
        <div className="space-y-1">
          {dates.map((date, index) => (
            <div key={index} className="text-sm">
              {date.label || date.type} ({new Date(date.date).toLocaleDateString()})
            </div>
          ))}
        </div>
      )
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row, table }) => {
      const person = row.original
      const meta = table.options.meta as PeopleColumnMeta | undefined

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
                onClick={() => meta?.onEdit(person.id)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => meta?.onDelete(person.id)}
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
