import { useEffect } from "react"
import { useInView } from "react-intersection-observer"

const ROOT_MARGIN_PX = 200

export const useInfiniteScroll = (
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void
) => {
  const { ref, inView } = useInView({ rootMargin: `${ROOT_MARGIN_PX}px` })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return { sentinelRef: ref }
}
