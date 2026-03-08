import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function FilterBar() {
  const statuses = [
    { label: "Completed", className: "status-success-border status-success-text" },
    { label: "Failed", className: "status-error-border status-error-text" },
    { label: "Opted out", className: "status-warning-border status-warning-text" },
    { label: "Unknown", className: "status-neutral-border status-neutral-text" },
  ]
  const sortOptions = [
    { value: "date_desc", label: "Newest first" },
    { value: "date_asc", label: "Oldest first" },
  ]

  return (
    <section className="rounded-3xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[2fr_1.6fr_0.9fr] lg:items-start">
        <div className="flex flex-col">
          <label className="h-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Search
          </label>
          <div className="mt-2">
            <Input placeholder="Package name" />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="h-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Status
          </label>
          <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2">
            {statuses.map((status) => (
              <Badge
                key={status.label}
                variant="outline"
                className={`px-3 py-1 ${status.className}`}
              >
                {status.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:justify-self-end">
          <label className="h-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Sort
          </label>
          <div className="mt-2">
            <Select defaultValue="date_desc">
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Newest first" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  )
}
