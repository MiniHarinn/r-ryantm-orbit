import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconExternalLink,
  IconNotes,
} from "@tabler/icons-react"
import { STATUS_META } from "@/lib/package-types"
import {
  formatDateTime,
  logUrl,
  nixSearchUrl,
  type PackageEntry,
} from "@/lib/package-data"

type PackageCardProps = {
  entry: PackageEntry
  showLocalTime: boolean
}

const statusFallback = STATUS_META[-1]

export function PackageCard({ entry, showLocalTime }: PackageCardProps) {
  const statusMeta = STATUS_META[entry.status] ?? statusFallback

  return (
    <Card size="sm" className="h-full w-full min-w-0 rounded-2xl border shadow-sm">
      <CardHeader className="min-w-0 gap-2">
        <CardTitle className="min-w-0">
          <h3 className="break-all text-base font-semibold">{entry.name}</h3>
        </CardTitle>
        <CardDescription className="inline-flex items-center gap-2 text-xs">
          <IconCalendar className="size-3.5" />
          {formatDateTime(entry.date, showLocalTime)}
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={`shrink-0 px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusMeta.className}`}
          >
            {statusMeta.label}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="rounded-2xl border bg-background px-3 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Version change
          </p>
          {entry.oldVersion &&
          entry.newVersion &&
          !(entry.oldVersion === "0" && entry.newVersion === "1") ? (
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
              {entry.oldVersion}
              <IconArrowRight className="size-4 text-muted-foreground" />
              {entry.newVersion}
            </p>
          ) : (
            <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <IconAlertCircle className="size-4" />
              Triggered by updateScript fetcher
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap gap-2 px-3 py-2">
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
      </CardFooter>
    </Card>
  )
}
