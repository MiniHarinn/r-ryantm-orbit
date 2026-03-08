import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MiniSearch from "minisearch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  IconCalendar,
  IconArrowRight,
  IconNotes,
  IconExternalLink,
} from "@tabler/icons-react"
import { STATUS_META, type PackageFilters } from "@/components/package-types"

type PackageEntry = {
  id: number
  name: string
  status: number
  date: number
  oldVersion?: string
  newVersion?: string
  error: string | null
}

type SearchRow = [number, string, number, number, number]
type ChunkRow = [number, string, number, number, string, string, string | null]

type SearchDoc = {
  id: number
  name: string
  status: number
  date: number
  lookupChunk: number
}

type SearchResult = {
  id: number
  lookupChunk: number
}

type PackageCardsProps = {
  filters: PackageFilters
}

const PAGE_SIZE = 50
const MIN_FILTERED_VISIBLE = 12

const statusFallback = STATUS_META[-1]

const rowToPackage = (row: ChunkRow): PackageEntry => ({
  id: row[0],
  name: row[1],
  status: row[2],
  date: row[3],
  oldVersion: row[4] || undefined,
  newVersion: row[5] || undefined,
  error: row[6],
})

const formatDate = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)

const logUrl = (pkg: string, ts: number) => {
  const date = formatDate(ts)
  return `https://nixpkgs-update-logs.nix-community.org/${encodeURIComponent(pkg)}/${date}.log`
}

const nixSearchUrl = (pkg: string) =>
  `https://search.nixos.org/packages?channel=unstable&query=${encodeURIComponent(pkg)}`

const sortPackages = (packages: PackageEntry[], sort: PackageFilters["sort"]) => {
  if (sort === "name-asc") {
    return [...packages].sort((a, b) => a.name.localeCompare(b.name))
  }
  return [...packages].sort((a, b) => b.date - a.date || a.name.localeCompare(b.name))
}

export function PackageCards({ filters }: PackageCardsProps) {
  const [browsePackages, setBrowsePackages] = useState<PackageEntry[]>([])
  const [searchPackages, setSearchPackages] = useState<PackageEntry[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchReady, setSearchReady] = useState(false)

  const hasMoreRef = useRef(true)
  const isLoadingRef = useRef(false)
  const browseChunkRef = useRef(1)
  const searchCursorRef = useRef(0)
  const miniSearchRef = useRef<MiniSearch<SearchDoc> | null>(null)
  const lookupCacheRef = useRef(new Map<number, PackageEntry[]>())
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const sentinelIntersectingRef = useRef(false)
  const visibleCountRef = useRef(0)
  const autoFillRef = useRef(false)
  const observerDrainRef = useRef(false)

  const query = filters.query.trim()
  const isSearchMode = query.length > 0

  const setLoadingState = (value: boolean) => {
    isLoadingRef.current = value
    setIsLoading(value)
  }

  const setHasMoreState = (value: boolean) => {
    hasMoreRef.current = value
    setHasMore(value)
  }

  const loadBrowseChunk = useCallback(async () => {
    if (isLoadingRef.current || !hasMoreRef.current) return false
    setLoadingState(true)
    setLoadError(null)

    const chunkIndex = browseChunkRef.current
    try {
      const res = await fetch(`/data/browse/${filters.sort}/chunk-${chunkIndex}.json`)
      if (!res.ok) {
        if (res.status === 404) {
          setHasMoreState(false)
          return false
        }
        throw new Error(`Failed to load chunk ${chunkIndex}`)
      }
      const data: { items: ChunkRow[] } = await res.json()
      if (!data.items || data.items.length === 0) {
        setHasMoreState(false)
        return false
      }
      const packages = data.items.map(rowToPackage)
      setBrowsePackages((prev) => [...prev, ...packages])
      browseChunkRef.current += 1
      return true
    } catch (error) {
      setLoadError("Unable to load package data.")
      setHasMoreState(false)
      return false
    } finally {
      setLoadingState(false)
    }
  }, [filters.sort])

  const loadSearchPage = useCallback(async () => {
    if (isLoadingRef.current || !hasMoreRef.current) return

    const cursor = searchCursorRef.current
    const page = searchResults.slice(cursor, cursor + PAGE_SIZE)
    if (page.length === 0) {
      setHasMoreState(false)
      return
    }

    setLoadingState(true)
    setLoadError(null)

    try {
      const chunkIds = Array.from(new Set(page.map((result) => result.lookupChunk)))
      const missingChunks = chunkIds.filter((chunkId) => !lookupCacheRef.current.has(chunkId))

      await Promise.all(
        missingChunks.map(async (chunkId) => {
          const res = await fetch(`/data/lookup/chunk-${chunkId}.json`)
          if (!res.ok) {
            throw new Error(`Failed to load lookup chunk ${chunkId}`)
          }
          const data: { items: ChunkRow[] } = await res.json()
          lookupCacheRef.current.set(chunkId, data.items.map(rowToPackage))
        })
      )

      const idToPackage = new Map<number, PackageEntry>()
      for (const chunkId of chunkIds) {
        const items = lookupCacheRef.current.get(chunkId)
        if (!items) continue
        for (const item of items) {
          idToPackage.set(item.id, item)
        }
      }

      const resolved = page
        .map((result) => idToPackage.get(result.id))
        .filter((item): item is PackageEntry => Boolean(item))

      setSearchPackages((prev) => [...prev, ...resolved])
      searchCursorRef.current = cursor + page.length
      if (searchCursorRef.current >= searchResults.length) {
        setHasMoreState(false)
      }
    } catch (error) {
      setLoadError("Unable to load search results.")
      setHasMoreState(false)
    } finally {
      setLoadingState(false)
    }
  }, [searchResults])

  useEffect(() => {
    let active = true

    const loadSearchIndex = async () => {
      try {
        const res = await fetch("/data/search-index.json")
        if (!res.ok) {
          throw new Error("Failed to load search index")
        }
        const rows: SearchRow[] = await res.json()
        if (!active) return
        const miniSearch = new MiniSearch<SearchDoc>({
          fields: ["name"],
          storeFields: ["id", "status", "date", "lookupChunk"],
        })
        const docs = rows.map((row) => ({
          id: row[0],
          name: row[1],
          status: row[2],
          date: row[3],
          lookupChunk: row[4],
        }))
        miniSearch.addAll(docs)
        miniSearchRef.current = miniSearch
        setSearchReady(true)
      } catch (error) {
        if (active) {
          setLoadError("Unable to load search index.")
        }
      }
    }

    loadSearchIndex()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isSearchMode) return
    setBrowsePackages([])
    browseChunkRef.current = 1
    setHasMoreState(true)
    setLoadError(null)
    void loadBrowseChunk()
  }, [filters.sort, isSearchMode, loadBrowseChunk])

  useEffect(() => {
    if (!isSearchMode) return
    if (!searchReady || !miniSearchRef.current) return

    const results = miniSearchRef.current.search(query) as unknown as SearchResult[]
    const resolvedResults = results.map((result) => ({
      id: result.id,
      lookupChunk: result.lookupChunk,
    }))

    setSearchResults(resolvedResults)
    setSearchPackages([])
    searchCursorRef.current = 0
    setHasMoreState(resolvedResults.length > 0)
    setLoadError(null)
  }, [isSearchMode, query, searchReady])

  useEffect(() => {
    if (!isSearchMode) return
    if (!searchReady) return
    if (searchResults.length === 0) return
    void loadSearchPage()
  }, [isSearchMode, searchReady, searchResults, loadSearchPage])

  const loadWhileIntersecting = useCallback(async () => {
    if (observerDrainRef.current) return
    observerDrainRef.current = true
    try {
      while (
        hasMoreRef.current &&
        !isLoadingRef.current &&
        sentinelIntersectingRef.current
      ) {
        const loaded = await loadBrowseChunk()
        if (!loaded) break
      }
    } finally {
      observerDrainRef.current = false
    }
  }, [loadBrowseChunk])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    if (!hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        sentinelIntersectingRef.current = entry.isIntersecting
        if (!entry.isIntersecting) return
        if (isSearchMode) {
          void loadSearchPage()
        } else {
          void loadWhileIntersecting()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isSearchMode, loadSearchPage, loadWhileIntersecting])

  const visiblePackages = useMemo(() => {
    const source = isSearchMode ? searchPackages : browsePackages
    const filtered =
      filters.status === "all"
        ? source
        : source.filter((entry) => entry.status === filters.status)
    return isSearchMode ? sortPackages(filtered, filters.sort) : filtered
  }, [browsePackages, filters.sort, filters.status, isSearchMode, searchPackages])

  useEffect(() => {
    visibleCountRef.current = visiblePackages.length
  }, [visiblePackages.length])

  const runAutoFill = useCallback(() => {
    if (isSearchMode) return
    if (filters.status === "all") return
    if (autoFillRef.current) return

    let cancelled = false
    const run = async () => {
      autoFillRef.current = true
      try {
        while (
          !cancelled &&
          hasMoreRef.current &&
          !isLoadingRef.current &&
          visibleCountRef.current < MIN_FILTERED_VISIBLE
        ) {
          const loaded = await loadBrowseChunk()
          if (!loaded) break
        }
      } finally {
        autoFillRef.current = false
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [filters.status, isSearchMode, loadBrowseChunk])

  useEffect(() => runAutoFill(), [runAutoFill])

  useEffect(() => {
    if (filters.status === "all") return
    if (isSearchMode) return
    if (visiblePackages.length >= MIN_FILTERED_VISIBLE) return
    runAutoFill()
  }, [
    browsePackages.length,
    filters.status,
    isSearchMode,
    runAutoFill,
    visiblePackages.length,
  ])

  return (
    <section className="space-y-4">
      {loadError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      {!loadError && !isLoading && visiblePackages.length === 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-6 text-sm text-muted-foreground">
          {isSearchMode ? "No results match your search yet." : "No packages to display."}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visiblePackages.map((entry) => {
          const statusMeta = STATUS_META[entry.status] ?? statusFallback
          return (
            <article
              key={`${entry.id}-${entry.date}`}
              className="flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 text-card-foreground shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-base font-semibold">{entry.name}</h3>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    Version info unavailable
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
        })}
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
