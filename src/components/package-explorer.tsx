import { useState } from "react"
import { FilterBar } from "@/components/filter-bar"
import { PackageCards } from "@/components/package-cards"
import { type PackageFilters } from "@/lib/package-types"

const defaultFilters: PackageFilters = {
  query: "",
  status: "all",
  sort: "date-desc",
}

export function PackageExplorer() {
  const [filters, setFilters] = useState<PackageFilters>(defaultFilters)

  return (
    <>
      <section className="sticky top-4 z-20 mx-auto w-full max-w-6xl px-6 pb-10">
        <FilterBar value={filters} onChange={setFilters} />
      </section>
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <PackageCards filters={filters} />
      </section>
    </>
  )
}
