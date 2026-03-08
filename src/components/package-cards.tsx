import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type PackageStatus = "Completed" | "Failed" | "Opted out" | "Unknown"

type PackageEntry = {
  name: string
  date: string
  status: PackageStatus
  oldVersion?: string
  newVersion?: string
  error?: string
}

const entries: PackageEntry[] = [
  {
    name: "alacritty",
    date: "2026-03-08",
    status: "Completed",
    oldVersion: "0.13.2",
    newVersion: "0.14.0",
  },
  {
    name: "deno",
    date: "2026-03-08",
    status: "Failed",
    oldVersion: "1.46.2",
    newVersion: "1.46.3",
    error: "build failed in checkPhase",
  },
  {
    name: "spotify",
    date: "2026-03-07",
    status: "Opted out",
  },
  {
    name: "zig",
    date: "2026-03-07",
    status: "Unknown",
    oldVersion: "0.13.0-dev",
    newVersion: "0.14.0-dev",
  },
]

const statusStyles: Record<PackageStatus, string> = {
  Completed: "status-success-border status-success-text",
  Failed: "status-error-border status-error-text",
  "Opted out": "status-warning-border status-warning-text",
  Unknown: "status-neutral-border status-neutral-text",
}

export function PackageCards() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <article
          key={`${entry.name}-${entry.date}`}
          className="flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 text-card-foreground shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">{entry.name}</h3>
              <p className="text-xs text-muted-foreground">{entry.date}</p>
            </div>
            <Badge
              variant="outline"
              className={`px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusStyles[entry.status]}`}
            >
              {entry.status}
            </Badge>
          </div>

          <div className="rounded-2xl border bg-background px-3 py-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Version change
            </p>
            {entry.oldVersion && entry.newVersion ? (
              <p className="mt-1 text-sm font-semibold">
                {entry.oldVersion} → {entry.newVersion}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Version info unavailable
              </p>
            )}
          </div>

          {entry.error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {entry.error}
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              View log
            </Button>
            <Button variant="outline" size="sm">
              Nix Search
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}
