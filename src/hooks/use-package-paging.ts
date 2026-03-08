import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PackageFilters } from "@/lib/package-types"
import type { ChunkRow, PackageEntry, SearchResult } from "@/lib/package-data"
import { rowToPackage, sortPackages } from "@/lib/package-data"

const PAGE_SIZE = 50
const MIN_FILTERED_VISIBLE = 12

type UsePackagePagingProps = {
  filters: PackageFilters
  isSearchMode: boolean
  searchResults: SearchResult[]
}

export const usePackagePaging = ({
  filters,
  isSearchMode,
  searchResults,
}: UsePackagePagingProps) => {
  const [browsePackages, setBrowsePackages] = useState<PackageEntry[]>([])
  const [searchPackages, setSearchPackages] = useState<PackageEntry[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const hasMoreRef = useRef(true)
  const isLoadingRef = useRef(false)
  const browseChunkRef = useRef(1)
  const searchCursorRef = useRef(0)
  const lookupCacheRef = useRef(new Map<number, PackageEntry[]>())
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const sentinelIntersectingRef = useRef(false)
  const autoFillRef = useRef(false)
  const resetPendingRef = useRef(false)
  const prevStatusRef = useRef<PackageFilters["status"]>(filters.status)

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
    if (isSearchMode) return
    setBrowsePackages([])
    browseChunkRef.current = 1
    setHasMoreState(true)
    setLoadError(null)
    resetPendingRef.current = false
    prevStatusRef.current = filters.status
    void loadBrowseChunk()
  }, [filters.sort, isSearchMode, loadBrowseChunk])

  useEffect(() => {
    if (!isSearchMode) return
    setSearchPackages([])
    searchCursorRef.current = 0
    setHasMoreState(searchResults.length > 0)
    setLoadError(null)
  }, [isSearchMode, searchResults])

  useEffect(() => {
    if (!isSearchMode) return
    if (searchResults.length === 0) return
    void loadSearchPage()
  }, [isSearchMode, searchResults, loadSearchPage])

  useEffect(() => {
    if (isSearchMode) return

    const prevStatus = prevStatusRef.current
    if (filters.status === "all" && prevStatus !== "all") {
      prevStatusRef.current = filters.status
      resetPendingRef.current = true
      sentinelIntersectingRef.current = false

      setBrowsePackages([])
      browseChunkRef.current = 1
      setHasMoreState(true)
      setLoadError(null)

      const run = async () => {
        await loadBrowseChunk()
        resetPendingRef.current = false
      }
      void run()
      return
    }

    prevStatusRef.current = filters.status
  }, [filters.status, isSearchMode, loadBrowseChunk])

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
        if (resetPendingRef.current) return
        if (isSearchMode) {
          void loadSearchPage()
        } else {
          void loadBrowseChunk()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isSearchMode, loadBrowseChunk, loadSearchPage])

  const visiblePackages = useMemo(() => {
    const source = isSearchMode ? searchPackages : browsePackages
    const filtered =
      filters.status === "all"
        ? source
        : source.filter((entry) => entry.status === filters.status)
    return isSearchMode ? sortPackages(filtered, filters.sort) : filtered
  }, [browsePackages, filters.sort, filters.status, isSearchMode, searchPackages])

  const runAutoFill = useCallback(() => {
    if (isSearchMode) return
    if (filters.status === "all") return
    if (autoFillRef.current) return
    if (visiblePackages.length >= MIN_FILTERED_VISIBLE) return

    let cancelled = false
    const run = async () => {
      autoFillRef.current = true
      try {
        while (
          !cancelled &&
          hasMoreRef.current &&
          !isLoadingRef.current &&
          visiblePackages.length < MIN_FILTERED_VISIBLE
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
  }, [filters.status, isSearchMode, loadBrowseChunk, visiblePackages.length])

  useEffect(() => runAutoFill(), [runAutoFill])

  return {
    visiblePackages,
    isLoading,
    hasMore,
    loadError,
    sentinelRef,
  }
}
