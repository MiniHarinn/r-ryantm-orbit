import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FilterBar } from "@/components/filter-bar"
import { PackageCards } from "@/components/package-cards"
import { type PackageFilters } from "@/lib/package-types"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  },
})

const defaultFilters: PackageFilters = {
  query: "",
  status: "all",
  sort: "date-desc",
}

export function PackageExplorer() {
  const [filters, setFilters] = useState<PackageFilters>(defaultFilters)
  return (
    <QueryClientProvider client={queryClient}>
      <section className="z-20 mx-auto w-full max-w-none px-4 pb-10 sm:max-w-6xl sm:px-6">
        <FilterBar value={filters} onChange={setFilters} />
      </section>
      <section className="mx-auto w-full max-w-none px-4 pb-16 sm:max-w-6xl sm:px-6">
        <PackageCards
          filters={filters}
          onClearFilters={() => setFilters(defaultFilters)}
        />
      </section>
    </QueryClientProvider>
  )
}
