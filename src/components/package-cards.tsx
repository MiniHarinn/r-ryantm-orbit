import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  IconCalendar,
  IconArrowRight,
  IconNotes,
  IconExternalLink,
} from "@tabler/icons-react"
import { STATUS_META, type PackageFilters } from "@/lib/package-types"
import {
  formatDate,
  logUrl,
  nixSearchUrl,
  type PackageEntry,
} from "@/lib/package-data"
import { usePackagePaging } from "@/hooks/use-package-paging"
import { usePackageSearch } from "@/hooks/use-package-search"

type PackageCardsProps = {
  filters: PackageFilters
}

const statusFallback = STATUS_META[-1]

const PackageCard = ({ entry }: { entry: PackageEntry }) => {
  const statusMeta = STATUS_META[entry.status] ?? statusFallback

  return (
    <article className="flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="wrap-break-word text-base font-semibold">{entry.name}</h3>
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <IconCalendar className="size-3.5" />
            {formatDate(entry.date)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusMeta.className}`}
        >
          {statusMeta.label}
        </Badge>
      </div>

      <div className="rounded-2xl border bg-background px-3 py-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Version change
        </p>
        {entry.oldVersion && entry.newVersion ? (
          <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
            {entry.oldVersion}
            <IconArrowRight className="size-4 text-muted-foreground" />
            {entry.newVersion}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Version info unavailable</p>
        )}
      </div>

      {entry.error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {entry.error}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={logUrl(entry.name, entry.date)} target="_blank" rel="noreferrer">
            <IconNotes className="size-4" />
            View log
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={nixSearchUrl(entry.name)} target="_blank" rel="noreferrer">
            <IconExternalLink className="size-4" />
            Nix Search
          </a>
        </Button>
      </div>
    </article>
  )
}

export function PackageCards({ filters }: PackageCardsProps) {
  const query = filters.query.trim()
  const isSearchMode = query.length > 0

  const { searchResults, searchError } = usePackageSearch(query)
  const { visiblePackages, isLoading, hasMore, loadError, sentinelRef } =
    usePackagePaging({
      filters,
      isSearchMode,
      searchResults,
    })

  const activeError = loadError ?? searchError

  return (
    <section className="space-y-4">
      {activeError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {activeError}
        </div>
      ) : null}

      {!activeError && !isLoading && visiblePackages.length === 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">
          {isSearchMode ? "No results match your search yet." : "No packages to display."}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visiblePackages.map((entry) => (
          <PackageCard key={`${entry.id}-${entry.date}`} entry={entry} />
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading packages...
        </div>
      ) : null}

      {hasMore ? <div ref={sentinelRef} className="h-4" aria-hidden="true" /> : null}
    </section>
  )
}
