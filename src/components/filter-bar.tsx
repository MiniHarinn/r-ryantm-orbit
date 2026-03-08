import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconSearch, IconFilter, IconSortAscending } from "@tabler/icons-react"
import { SORT_OPTIONS, STATUS_FILTERS, STATUS_META, type PackageFilters } from "@/components/package-types"

type FilterBarProps = {
  value: PackageFilters
  onChange: (next: PackageFilters) => void
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  return (
    <section className="rounded-3xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[2fr_1.6fr_0.9fr] lg:items-start">
        <div className="flex flex-col">
          <label className="inline-flex h-4 items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <IconSearch className="size-4" />
            Search
          </label>
          <div className="mt-2">
            <Input
              placeholder="Package name"
              value={value.query}
              onChange={(event) => onChange({ ...value, query: event.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="inline-flex h-4 items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <IconFilter className="size-4" />
            Status
          </label>
          <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((status) => {
              const meta = status.value === "all" ? null : STATUS_META[status.value]
              const isActive = value.status === status.value
              const baseClass = meta ? meta.className : "status-neutral-border status-neutral-text"
              const activeClass = isActive ? "bg-muted text-foreground" : "opacity-70 hover:opacity-100"
              return (
                <button
                  key={status.label}
                  type="button"
                  className="rounded-full"
                  onClick={() => onChange({ ...value, status: status.value })}
                >
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 ${baseClass} ${activeClass}`}
                  >
                    {status.label}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col lg:justify-self-end">
          <label className="inline-flex h-4 items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <IconSortAscending className="size-4" />
            Sort
          </label>
          <div className="mt-2">
            <Select
              value={value.sort}
              onValueChange={(next) =>
                onChange({ ...value, sort: next as PackageFilters["sort"] })
              }
            >
              <SelectTrigger className="w-full lg:w-55">
                <SelectValue placeholder="Newest first" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
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
