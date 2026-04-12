import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PackageFilters } from "@/lib/package-types"
import type { ChunkRow, PackageEntry, SearchResult } from "@/lib/package-data"
import { rowToPackage, sortPackages } from "@/lib/package-data"

const PAGE_SIZE = 50
const MIN_FILTERED_VISIBLE = 12
const ROOT_MARGIN_PX = 200
const MAX_DRAIN_CYCLES = 3

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
  const userScrolledRef = useRef(false)
  const drainInProgressRef = useRef(false)
  const browseKeyRef = useRef<string | null>(null)

  const browseKey = `${filters.sort}:${filters.status}`
  const browseResetPending = !isSearchMode && browseKeyRef.current !== browseKey
  if (browseResetPending) {
    browseKeyRef.current = browseKey
  }

  const setLoadingState = (value: boolean) => {
    isLoadingRef.current = value
    setIsLoading(value)
  }

  const setHasMoreState = (value: boolean) => {
    hasMoreRef.current = value
    setHasMore(value)
  }

  const canLoadMore = useCallback(
    () => hasMoreRef.current && !isLoadingRef.current,
    []
  )

  const loadBrowseChunk = useCallback(async () => {
    if (!canLoadMore()) return false
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
    } catch {
      setLoadError("Unable to load package data.")
      setHasMoreState(false)
      return false
    } finally {
      setLoadingState(false)
    }
  }, [canLoadMore, filters.sort])

  const loadSearchPage = useCallback(async () => {
    if (!canLoadMore()) return

    const cursor = searchCursorRef.current
    const page = searchResults.slice(cursor, cursor + PAGE_SIZE)
    if (page.length === 0) {
      setHasMoreState(false)
      return
    }

    setLoadingState(true)
    setLoadError(null)

    try {
      const chunkIds = Array.from(
        new Set(page.map((result) => result.lookupChunk))
      )
      const missingChunks = chunkIds.filter(
        (chunkId) => !lookupCacheRef.current.has(chunkId)
      )

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
    } catch {
      setLoadError("Unable to load search results.")
      setHasMoreState(false)
    } finally {
      setLoadingState(false)
    }
  }, [canLoadMore, searchResults])

  useEffect(() => {
    if (isSearchMode) return
    setBrowsePackages([])
    browseChunkRef.current = 1
    setHasMoreState(true)
    setLoadError(null)
    userScrolledRef.current = false
    void loadBrowseChunk()
  }, [filters.sort, filters.status, isSearchMode, loadBrowseChunk])

  useEffect(() => {
    if (!isSearchMode) return
    setSearchPackages([])
    searchCursorRef.current = 0
    setHasMoreState(searchResults.length > 0)
    setLoadError(null)
    userScrolledRef.current = false
    if (searchResults.length > 0) {
      void loadSearchPage()
    }
  }, [isSearchMode, searchResults, loadSearchPage])

  const isSentinelInView = useCallback(() => {
    const node = sentinelRef.current
    if (!node) return false
    const rect = node.getBoundingClientRect()
    return rect.top <= window.innerHeight + ROOT_MARGIN_PX
  }, [])

  const drainBrowseWhileInView = useCallback(async () => {
    if (drainInProgressRef.current) return
    drainInProgressRef.current = true
    try {
      let cycles = 0
      while (
        cycles < MAX_DRAIN_CYCLES &&
        userScrolledRef.current &&
        canLoadMore() &&
        isSentinelInView()
      ) {
        cycles += 1
        const loaded = await loadBrowseChunk()
        if (!loaded) break
      }
    } finally {
      drainInProgressRef.current = false
    }
  }, [canLoadMore, isSentinelInView, loadBrowseChunk])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false
        sentinelIntersectingRef.current = isIntersecting
        if (!isIntersecting) return
        if (!userScrolledRef.current || !canLoadMore()) return
        if (isSearchMode) {
          void loadSearchPage()
        } else {
          void drainBrowseWhileInView()
        }
      },
      { rootMargin: `${ROOT_MARGIN_PX}px` }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [canLoadMore, drainBrowseWhileInView, isSearchMode, loadSearchPage])

  useEffect(() => {
    let rafId: number | null = null

    const scheduleLoadIfNeeded = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (!userScrolledRef.current || !canLoadMore()) return

        const inView = sentinelIntersectingRef.current || isSentinelInView()
        if (!inView) return

        if (isSearchMode) {
          void loadSearchPage()
        } else {
          void drainBrowseWhileInView()
        }
      })
    }

    const markUserIntent = () => {
      if (!userScrolledRef.current) {
        userScrolledRef.current = true
      }
      scheduleLoadIfNeeded()
    }

    const onScroll = () => {
      if (!userScrolledRef.current) return
      scheduleLoadIfNeeded()
    }

    const onKeydown = (event: KeyboardEvent) => {
      const keys = [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "Home",
        "End",
        " ",
      ]
      if (keys.includes(event.key)) {
        markUserIntent()
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("wheel", markUserIntent, { passive: true })
    window.addEventListener("touchmove", markUserIntent, { passive: true })
    window.addEventListener("keydown", onKeydown)
    window.addEventListener("resize", scheduleLoadIfNeeded)
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("wheel", markUserIntent)
      window.removeEventListener("touchmove", markUserIntent)
      window.removeEventListener("keydown", onKeydown)
      window.removeEventListener("resize", scheduleLoadIfNeeded)
    }
  }, [
    canLoadMore,
    drainBrowseWhileInView,
    isSearchMode,
    isSentinelInView,
    loadSearchPage,
  ])

  const visiblePackages = useMemo(() => {
    if (browseResetPending) return []
    const source = isSearchMode ? searchPackages : browsePackages
    const filtered =
      filters.status === "all"
        ? source
        : source.filter((entry) => entry.status === filters.status)
    return isSearchMode ? sortPackages(filtered, filters.sort) : filtered
  }, [
    browsePackages,
    browseResetPending,
    filters.sort,
    filters.status,
    isSearchMode,
    searchPackages,
  ])

  useEffect(() => {
    if (isSearchMode) return
    if (filters.status === "all") return
    if (visiblePackages.length >= MIN_FILTERED_VISIBLE) return
    if (!canLoadMore()) return
    void loadBrowseChunk()
  }, [
    canLoadMore,
    filters.status,
    isSearchMode,
    loadBrowseChunk,
    visiblePackages.length,
  ])

  return {
    visiblePackages,
    isLoading,
    hasMore,
    loadError,
    sentinelRef,
  }
}
