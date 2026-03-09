export type PackageFilters = {
  query: string
  status: number | "all"
  sort: "date-desc" | "name-asc" | "date-asc" | "name-desc"
}

export type StatusMeta = {
  label: string
  className: string
}

export const STATUS_META: Record<number, StatusMeta> = {
  "-1": { label: "Other", className: "status-neutral-border status-neutral-text" },
  0: { label: "Failed", className: "status-error-border status-error-text" },
  1: { label: "Success", className: "status-success-border status-success-text" },
  2: { label: "Skipped", className: "status-warning-border status-warning-text" },
  3: { label: "Duplicate", className: "status-indigo-border status-indigo-text" },
  4: { label: "No change", className: "status-neutral-border status-neutral-text" },
  5: { label: "Invalid", className: "status-error-border status-error-text" },
}

export const STATUS_FILTERS: Array<{ value: PackageFilters["status"]; label: string }> =
  [
    { value: "all", label: "All" },
    { value: 1, label: "Success" },
    { value: 0, label: "Failed" },
    { value: 2, label: "Skipped" },
    { value: 3, label: "Duplicate" },
    { value: 4, label: "No change" },
    { value: 5, label: "Invalid" },
    { value: -1, label: "Other" },
  ]

export const SORT_OPTIONS: Array<{ value: PackageFilters["sort"]; label: string }> =
  [
    { value: "date-desc", label: "Newest first" },
    { value: "date-asc", label: "Oldest first" },
    { value: "name-asc", label: "A to Z" },
    { value: "name-desc", label: "Z to A" },
  ]
