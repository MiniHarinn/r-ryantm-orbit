import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { PackageCard } from "@/components/package-card"
import { IconLoader2, IconConfetti, IconZoomCancel } from "@tabler/icons-react"
import { type PackageFilters } from "@/lib/package-types"
import { useBrowsePackages } from "@/hooks/use-browse-packages"
import { useSearchPackages } from "@/hooks/use-search-packages"
import { usePackageSearch } from "@/hooks/use-package-search"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { useTimeDisplay } from "@/hooks/use-time-display"

const MIN_FILTERED_VISIBLE = 12

type PackageCardsProps = {
  filters: PackageFilters
  onClearFilters: () => void
}

export function PackageCards({ filters, onClearFilters }: PackageCardsProps) {
  const query = filters.query.trim()
  const isSearchMode = query.length > 0
  const hasActiveFilters =
    query.length > 0 || filters.status !== "all" || filters.sort !== "date-desc"

  const { searchResults, searchError } = usePackageSearch(query)

  const browse = useBrowsePackages(filters, !isSearchMode)
  const search = useSearchPackages(searchResults, isSearchMode)

  const active = isSearchMode ? search : browse
  const { sentinelRef } = useInfiniteScroll(
    active.hasNextPage,
    active.isFetchingNextPage,
    active.fetchNextPage
  )

  const visiblePackages = useMemo(() => {
    const source = active.allPackages
    const filtered =
      filters.status === "all"
        ? source
        : source.filter((entry) => entry.status === filters.status)
    return filtered
  }, [active.allPackages, filters.status, filters.sort, isSearchMode])

  // Auto-load more when status filter yields too few visible results
  useEffect(() => {
    if (isSearchMode) return
    if (filters.status === "all") return
    if (visiblePackages.length >= MIN_FILTERED_VISIBLE) return
    if (!browse.hasNextPage || browse.isFetchingNextPage) return
    browse.fetchNextPage()
  }, [
    isSearchMode,
    filters.status,
    visiblePackages.length,
    browse.hasNextPage,
    browse.isFetchingNextPage,
    browse.fetchNextPage,
  ])

  const { showLocalTime } = useTimeDisplay()
  const activeError = active.error ?? searchError
  const isLoading = active.isLoading || active.isFetchingNextPage
  const hasMore = active.hasNextPage

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
              {isSearchMode
                ? "No results match your search yet."
                : "No packages to display."}
            </span>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
              >
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

      {isLoading ? (
        <div className="animate-in rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground delay-150 fill-mode-both fade-in">
          <span className="inline-flex items-center gap-2">
            <IconLoader2 className="size-4 animate-spin" />
            Loading packages...
          </span>
        </div>
      ) : null}

      {!isLoading && !activeError && !hasMore && visiblePackages.length > 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <IconConfetti className="size-4" />
            Yep, That&apos;s all!
          </span>
        </div>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="h-4" aria-hidden="true" />
      ) : null}
    </section>
  )
}
