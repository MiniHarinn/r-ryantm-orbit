export type PackageEntry = {
  id: number
  name: string
  status: number
  date: number
  oldVersion?: string
  newVersion?: string
  error: string | null
}

export type SearchRow = [number, string, number, number, number]
export type ChunkRow = [number, string, number, number, string, string, string | null]

export type SearchDoc = {
  id: number
  name: string
  status: number
  date: number
  lookupChunk: number
}

export type SearchResult = {
  id: number
  lookupChunk: number
}

export const rowToPackage = (row: ChunkRow): PackageEntry => ({
  id: row[0],
  name: row[1],
  status: row[2],
  date: row[3],
  oldVersion: row[4] || undefined,
  newVersion: row[5] || undefined,
  error: row[6],
})

export const formatDate = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)

export const logUrl = (pkg: string, ts: number) => {
  const date = formatDate(ts)
  return `https://nixpkgs-update-logs.nix-community.org/${encodeURIComponent(pkg)}/${date}.log`
}

export const nixSearchUrl = (pkg: string) =>
  `https://search.nixos.org/packages?channel=unstable&query=${encodeURIComponent(pkg)}`

export const sortPackages = (
  packages: PackageEntry[],
  sort: "date-desc" | "name-asc"
) => {
  if (sort === "name-asc") {
    return [...packages].sort((a, b) => a.name.localeCompare(b.name))
  }
  return [...packages].sort((a, b) => b.date - a.date || a.name.localeCompare(b.name))
}
