import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconSearch, IconFilter, IconSortAscending, IconX } from "@tabler/icons-react"
import { SORT_OPTIONS, STATUS_FILTERS, STATUS_META, type PackageFilters } from "@/lib/package-types"

type FilterBarProps = {
  value: PackageFilters
  onChange: (next: PackageFilters) => void
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  const [queryDraft, setQueryDraft] = useState(value.query)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setQueryDraft(value.query)
  }, [value.query])

  useEffect(() => {
    if (queryDraft === value.query) return
    const timer = setTimeout(() => {
      onChange({ ...value, query: queryDraft })
    }, 200)

    return () => clearTimeout(timer)
  }, [onChange, queryDraft, value])

  return (
    <section className="w-full rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[2fr_1.6fr_0.9fr] lg:items-start">
        <div className="flex flex-col">
          <label className="inline-flex h-4 items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <IconSearch className="size-4" />
            Search
          </label>
          <div className="mt-2 relative">
            <Input
              ref={inputRef}
              placeholder="Package name"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
            />
            {queryDraft.trim().length > 0 ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/70 text-xs text-muted-foreground shadow-sm transition hover:bg-muted/60 hover:text-foreground"
                onClick={() => {
                  setQueryDraft("")
                  onChange({ ...value, query: "" })
                  inputRef.current?.focus()
                }}
                aria-label="Clear search"
              >
                <IconX className="size-3.5" />
              </button>
            ) : null}
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
