import { useEffect, useRef, useState } from "react"
import MiniSearch from "minisearch"
import type { SearchDoc, SearchResult, SearchRow } from "@/lib/package-data"

export const usePackageSearch = (query: string) => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchReady, setSearchReady] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const miniSearchRef = useRef<MiniSearch<SearchDoc> | null>(null)

  useEffect(() => {
    let active = true

    const loadSearchIndex = async () => {
      try {
        const res = await fetch("/data/search-index.json")
        if (!res.ok) {
          throw new Error("Failed to load search index")
        }
        const rows: SearchRow[] = await res.json()
        if (!active) return
        const miniSearch = new MiniSearch<SearchDoc>({
          fields: ["name"],
          storeFields: ["id", "status", "date", "lookupChunk"],
        })
        const docs = rows.map((row) => ({
          id: row[0],
          name: row[1],
          status: row[2],
          date: row[3],
          lookupChunk: row[4],
        }))
        miniSearch.addAll(docs)
        miniSearchRef.current = miniSearch
        setSearchReady(true)
      } catch {
        if (active) {
          setSearchError("Unable to load search index.")
        }
      }
    }

    loadSearchIndex()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setSearchResults([])
      return
    }
    if (!searchReady || !miniSearchRef.current) return

    const results = miniSearchRef.current.search(
      trimmed
    ) as unknown as SearchResult[]
    const resolvedResults = results.map((result) => ({
      id: result.id,
      lookupChunk: result.lookupChunk,
    }))

    setSearchResults(resolvedResults)
  }, [query, searchReady])

  return { searchResults, searchReady, searchError }
}
