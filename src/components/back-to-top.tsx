import * as React from "react"
import { IconArrowUp } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type BackToTopProps = {
  className?: string
  showAfter?: number
}

const DEFAULT_SHOW_AFTER = 320

export function BackToTop({
  className,
  showAfter = DEFAULT_SHOW_AFTER,
}: BackToTopProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > showAfter)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [showAfter])

  const handleClick = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    })
  }

  return (
    <div
      className={cn(
        "fixed right-6 bottom-6 z-50 transition-all duration-300",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
        className
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handleClick}
        aria-label="Back to top"
      >
        <IconArrowUp className="size-4" />
        Back to top
      </Button>
    </div>
  )
}
