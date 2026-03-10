import * as React from "react"
import {
  IconActivity,
  IconStack2,
  IconCheck,
  IconAlertTriangle,
  IconHandStop,
  IconCopy,
  IconMinus,
  IconAlertCircle,
  IconDots,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useTimeDisplay } from "@/hooks/use-time-display"

export type FleetStats = {
  total: string
  success: string
  failed: string
  skipped: string
  duplicate: string
  noChange: string
  invalid: string
  other: string
  updatedAt: string
}

type FleetOverviewProps = Partial<FleetStats>

export default function FleetOverview({
  total,
  success,
  failed,
  skipped,
  duplicate,
  noChange,
  invalid,
  other,
  updatedAt,
}: FleetOverviewProps) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [current, setCurrent] = React.useState(1)
  const [count, setCount] = React.useState(1)
  const [canPrev, setCanPrev] = React.useState(false)
  const [canNext, setCanNext] = React.useState(false)
  const [localUpdatedAt, setLocalUpdatedAt] = React.useState("")
  const { showLocalTime, setShowLocalTime } = useTimeDisplay()

  React.useEffect(() => {
    if (!updatedAt) {
      setLocalUpdatedAt("")
      return
    }
    const parsed = new Date(updatedAt)
    if (Number.isNaN(parsed.getTime())) {
      setLocalUpdatedAt("")
      return
    }
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    })
    const parts = formatter.formatToParts(parsed)
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? ""
    const formatted = `${get("year")}-${get("month")}-${get("day")} ${get(
      "hour"
    )}:${get("minute")} ${get("timeZoneName")}`.trim()
    setLocalUpdatedAt(formatted)
  }, [updatedAt])

  React.useEffect(() => {
    if (!api) return
    const updateState = () => {
      setCurrent(api.selectedScrollSnap() + 1)
      setCount(api.scrollSnapList().length)
      setCanPrev(api.canScrollPrev())
      setCanNext(api.canScrollNext())
    }
    updateState()
    api.on("select", updateState)
    api.on("reInit", updateState)
    return () => {
      api.off("select", updateState)
      api.off("reInit", updateState)
    }
  }, [api])

  const resolvedUpdatedAt =
    showLocalTime && localUpdatedAt ? localUpdatedAt : updatedAt
  return (
    <aside className="w-full rounded-3xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-2 text-xs tracking-[0.3em] text-muted-foreground uppercase">
            <IconActivity className="size-4" />
            Status snapshot
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Fleet overview
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => api?.scrollPrev()}
            disabled={!canPrev}
            aria-label="Previous stats page"
          >
            <IconChevronLeft />
          </Button>
          <span className="min-w-10 text-center text-[11px] text-muted-foreground">
            {current}/{count}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => api?.scrollNext()}
            disabled={!canNext}
            aria-label="Next stats page"
          >
            <IconChevronRight />
          </Button>
        </div>
      </div>

      <Carousel className="mt-6" setApi={setApi} opts={{ align: "start" }}>
        <CarouselContent>
          <CarouselItem>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconStack2 className="size-3" />
                  Total
                </p>
                <p className="mt-2 text-2xl font-semibold">{total}</p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconCheck className="size-3" />
                  Success
                </p>
                <p className="status-success-text mt-2 text-2xl font-semibold">
                  {success}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconAlertTriangle className="size-3" />
                  Failed
                </p>
                <p className="status-error-text mt-2 text-2xl font-semibold">
                  {failed}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconHandStop className="size-3" />
                  Skipped
                </p>
                <p className="status-warning-text mt-2 text-2xl font-semibold">
                  {skipped}
                </p>
              </div>
            </div>
          </CarouselItem>
          <CarouselItem>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconCopy className="size-3" />
                  Duplicate
                </p>
                <p className="status-indigo-text mt-2 text-2xl font-semibold">
                  {duplicate}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconMinus className="size-3" />
                  No change
                </p>
                <p className="status-nochange-text mt-2 text-2xl font-semibold">
                  {noChange}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconAlertCircle className="size-3" />
                  Invalid
                </p>
                <p className="status-invalid-text mt-2 text-2xl font-semibold">
                  {invalid}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
                  <IconDots className="size-3" />
                  Other
                </p>
                <p className="status-other-text mt-2 text-2xl font-semibold">
                  {other}
                </p>
              </div>
            </div>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className="mt-6 rounded-2xl border bg-background px-4 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>Updated At:</span>
            <span className="text-foreground">{resolvedUpdatedAt}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
            <span>Local</span>
            <Switch
              aria-label="Toggle UTC time"
              size="sm"
              checked={!showLocalTime}
              disabled={!localUpdatedAt}
              onCheckedChange={(nextChecked) => setShowLocalTime(!nextChecked)}
            />
            <span>UTC</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
