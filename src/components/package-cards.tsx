import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  IconCalendar,
  IconArrowRight,
  IconNotes,
  IconExternalLink,
  IconLoader2,
  IconConfetti,
  IconZoomCancel,
  IconAlertCircle,
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
import { useEffect, useRef, useState } from "react"

type PackageCardsProps = {
  filters: PackageFilters
  onClearFilters: () => void
}

const statusFallback = STATUS_META[-1]

const PackageCard = ({ entry }: { entry: PackageEntry }) => {
  const statusMeta = STATUS_META[entry.status] ?? statusFallback

  return (
    <article className="flex h-full w-full min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
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
        {entry.oldVersion &&
        entry.newVersion &&
        !(entry.oldVersion === "0" && entry.newVersion === "1") ? (
          <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
            {entry.oldVersion}
            <IconArrowRight className="size-4 text-muted-foreground" />
            {entry.newVersion}
          </p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <IconAlertCircle className="size-4" />
            No version information
          </p>
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

export function PackageCards({ filters, onClearFilters }: PackageCardsProps) {
  const query = filters.query.trim()
  const isSearchMode = query.length > 0
  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.status !== "all" ||
    filters.sort !== "date-desc"

  const { searchResults, searchError } = usePackageSearch(query)
  const { visiblePackages, isLoading, hasMore, loadError, sentinelRef } =
    usePackagePaging({
      filters,
      isSearchMode,
      searchResults,
    })

  const [showLoading, setShowLoading] = useState(false)
  const loadingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (isLoading) {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current)
      }
      loadingTimerRef.current = window.setTimeout(() => {
        setShowLoading(true)
      }, 150)
      return
    }

    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setShowLoading(false)
  }, [isLoading])

  useEffect(
    () => () => {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current)
      }
    },
    []
  )

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <IconZoomCancel className="size-4" />
            {isSearchMode ? "No results match your search yet." : "No packages to display."}
          </span>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visiblePackages.map((entry) => (
          <PackageCard key={`${entry.id}-${entry.date}`} entry={entry} />
        ))}
      </div>

      {showLoading ? (
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <IconLoader2 className="size-4 animate-spin" />
            Loading packages...
          </span>
        </div>
      ) : null}

      {!showLoading && !activeError && !hasMore && visiblePackages.length > 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <IconConfetti className="size-4" />
            Yep, That&apos;s all!
          </span>
        </div>
      ) : null}

      {hasMore ? <div ref={sentinelRef} className="h-4" aria-hidden="true" /> : null}
    </section>
  )
}
