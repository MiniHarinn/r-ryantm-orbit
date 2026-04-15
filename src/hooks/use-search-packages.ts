import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import type { ChunkRow, PackageEntry, SearchResult } from "@/lib/package-data"
import { rowToPackage } from "@/lib/package-data"

const PAGE_SIZE = 50

export const useSearchPackages = (
  searchResults: SearchResult[],
  enabled: boolean
) => {
  const query = useInfiniteQuery<PackageEntry[]>({
    queryKey: ["search", searchResults],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as number
      const page = searchResults.slice(cursor, cursor + PAGE_SIZE)
      if (page.length === 0) return []

      const chunkIds = Array.from(
        new Set(page.map((result) => result.lookupChunk))
      )

      const chunkMap = new Map<number, PackageEntry[]>()
      await Promise.all(
        chunkIds.map(async (chunkId) => {
          const res = await fetch(`/data/lookup/chunk-${chunkId}.json`)
          if (!res.ok) throw new Error(`Failed to load lookup chunk ${chunkId}`)
          const data: { items: ChunkRow[] } = await res.json()
          chunkMap.set(chunkId, data.items.map(rowToPackage))
        })
      )

      const idToPackage = new Map<number, PackageEntry>()
      for (const [, items] of chunkMap) {
        for (const item of items) {
          idToPackage.set(item.id, item)
        }
      }

      return page
        .map((result) => idToPackage.get(result.id))
        .filter((item): item is PackageEntry => Boolean(item))
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, _allPages, lastPageParam) => {
      const nextCursor = (lastPageParam as number) + PAGE_SIZE
      if (nextCursor >= searchResults.length) return undefined
      return nextCursor
    },
    enabled: enabled && searchResults.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const allPackages = useMemo(
    () => query.data?.pages.flatMap((page) => page) ?? [],
    [query.data]
  )

  return {
    allPackages,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  }
}
