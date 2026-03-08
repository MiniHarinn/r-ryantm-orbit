export type PackageFilters = {
  query: string
  status: number | "all"
  sort: "date-desc" | "name-asc"
}

export type StatusMeta = {
  label: string
  className: string
}

export const STATUS_META: Record<number, StatusMeta> = {
  "-1": { label: "Unknown", className: "status-neutral-border status-neutral-text" },
  0: { label: "Failed", className: "status-error-border status-error-text" },
  1: { label: "Completed", className: "status-success-border status-success-text" },
  2: { label: "Opted out", className: "status-warning-border status-warning-text" },
  3: { label: "Already updated", className: "status-indigo-border status-indigo-text" },
}

export const STATUS_FILTERS: Array<{ value: PackageFilters["status"]; label: string }> =
  [
    { value: "all", label: "All" },
    { value: 1, label: "Completed" },
    { value: 0, label: "Failed" },
    { value: 2, label: "Opted out" },
    { value: 3, label: "Already updated" },
    { value: -1, label: "Unknown" },
  ]

export const SORT_OPTIONS: Array<{ value: PackageFilters["sort"]; label: string }> =
  [
    { value: "date-desc", label: "Newest first" },
    { value: "name-asc", label: "A to Z" },
  ]
