import { Button } from "@/components/ui/button"
import { PackageCard } from "@/components/package-card"
import {
  IconLoader2,
  IconConfetti,
  IconZoomCancel,
} from "@tabler/icons-react"
import { type PackageFilters } from "@/lib/package-types"
import { usePackagePaging } from "@/hooks/use-package-paging"
import { usePackageSearch } from "@/hooks/use-package-search"
import { useTimeDisplay } from "@/hooks/use-time-display"
import { useEffect, useRef, useState } from "react"

type PackageCardsProps = {
  filters: PackageFilters
  onClearFilters: () => void
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
  const { showLocalTime } = useTimeDisplay()

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
          <PackageCard
            key={`${entry.id}-${entry.date}`}
            entry={entry}
            showLocalTime={showLocalTime}
          />
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
