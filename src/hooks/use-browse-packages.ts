import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import type { PackageFilters } from "@/lib/package-types"
import type { ChunkRow, PackageEntry } from "@/lib/package-data"
import { rowToPackage } from "@/lib/package-data"

export const useBrowsePackages = (
  filters: PackageFilters,
  enabled: boolean
) => {
  const query = useInfiniteQuery<PackageEntry[]>({
    queryKey: ["browse", filters.sort],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(
        `/data/browse/${filters.sort}/chunk-${pageParam}.json`
      )
      if (!res.ok) {
        if (res.status === 404) return []
        throw new Error(`Failed to load chunk ${pageParam}`)
      }
      const data: { items: ChunkRow[] } = await res.json()
      if (!data.items || data.items.length === 0) return []
      return data.items.map(rowToPackage)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length === 0) return undefined
      return (lastPageParam as number) + 1
    },
    enabled,
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
