package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"
	"unicode"
)

func writeOutput(baseDir string, entries []LogEntry, chunkSize int) error {
	if chunkSize < 1 {
		chunkSize = 100
	}
	publicDir := filepath.Join(baseDir, "public")
	astroStaticDir := filepath.Join(baseDir, "astro-static")
	searchIndexPath := filepath.Join(publicDir, "search-index.json")
	metaPath := filepath.Join(astroStaticDir, "meta.json")
	lookupDir := filepath.Join(publicDir, "lookup")
	browseDateDir := filepath.Join(publicDir, "browse", "date-desc")
	browseDateAscDir := filepath.Join(publicDir, "browse", "date-asc")
	browseNameDir := filepath.Join(publicDir, "browse", "name-asc")
	browseNameDescDir := filepath.Join(publicDir, "browse", "name-desc")

	for _, dir := range []string{
		publicDir,
		astroStaticDir,
		lookupDir,
		browseDateDir,
		browseDateAscDir,
		browseNameDir,
		browseNameDescDir,
	} {
		if err := ensureDir(dir); err != nil {
			return err
		}
	}

	searchIndexRows := make([][]any, 0, len(entries))
	lookupRows := make([][]any, 0, len(entries))

	for _, entry := range entries {
		lookupChunk := (len(lookupRows) / chunkSize) + 1
		errorValue := errorField(entry.Error)
		searchIndexRows = append(searchIndexRows, []any{entry.ID, entry.Package, entry.Status, entry.Date, lookupChunk})
		lookupRows = append(lookupRows, []any{entry.ID, entry.Package, entry.Status, entry.Date, entry.OldVer, entry.NewVer, errorValue})
	}

	if err := writeChunks(lookupDir, lookupRows, chunkSize); err != nil {
		return err
	}
	if err := writeJSON(searchIndexPath, searchIndexRows); err != nil {
		return err
	}
	if err := writeJSON(metaPath, buildMeta(entries, chunkSize)); err != nil {
		return err
	}

	dateDesc := sortByDate(entries, false)
	if err := writeBrowseChunks(browseDateDir, dateDesc, chunkSize); err != nil {
		return err
	}
	dateAsc := sortByDate(entries, true)
	if err := writeBrowseChunks(browseDateAscDir, dateAsc, chunkSize); err != nil {
		return err
	}
	nameAsc := sortByName(entries, true)
	if err := writeBrowseChunks(browseNameDir, nameAsc, chunkSize); err != nil {
		return err
	}
	nameDesc := sortByName(entries, false)
	if err := writeBrowseChunks(browseNameDescDir, nameDesc, chunkSize); err != nil {
		return err
	}

	return nil
}

func writeBrowseChunks(dir string, entries []LogEntry, chunkSize int) error {
	rows := make([][]any, 0, len(entries))
	for _, entry := range entries {
		rows = append(rows, []any{entry.ID, entry.Package, entry.Status, entry.Date, entry.OldVer, entry.NewVer, errorField(entry.Error)})
	}
	return writeChunks(dir, rows, chunkSize)
}

func errorField(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func writeChunks(dir string, rows [][]any, chunkSize int) error {
	for i := 0; i < len(rows); i += chunkSize {
		end := i + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		chunk := map[string]any{
			"items": rows[i:end],
		}
		path := filepath.Join(dir, fmt.Sprintf("chunk-%d.json", (i/chunkSize)+1))
		if err := writeJSON(path, chunk); err != nil {
			return err
		}
	}
	return nil
}

func writeJSON(path string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func ensureDir(path string) error {
	if path == "" || path == "." {
		return nil
	}
	return os.MkdirAll(path, 0o755)
}

func buildMeta(entries []LogEntry, chunkSize int) map[string]any {
	statusCounts := make(map[string]int)
	for _, entry := range entries {
		key := strconv.Itoa(int(entry.Status))
		statusCounts[key]++
	}

	return map[string]any{
		"generated_at": time.Now().UTC().Format(time.RFC3339),
		"chunk_size":   chunkSize,
		"total":        len(entries),
		"status":       statusCounts,
	}
}

func sortByDate(entries []LogEntry, asc bool) []LogEntry {
	sorted := append([]LogEntry(nil), entries...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Date == sorted[j].Date {
			return sorted[i].Package < sorted[j].Package
		}
		if asc {
			return sorted[i].Date < sorted[j].Date
		}
		return sorted[i].Date > sorted[j].Date
	})
	return sorted
}

func sortByName(entries []LogEntry, asc bool) []LogEntry {
	sorted := append([]LogEntry(nil), entries...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Package == sorted[j].Package {
			return sorted[i].Date > sorted[j].Date
		}
		if asc {
			return comparePackageName(sorted[i].Package, sorted[j].Package) < 0
		}
		return comparePackageName(sorted[i].Package, sorted[j].Package) > 0
	})
	return sorted
}

func comparePackageName(a, b string) int {
	ar := []rune(a)
	br := []rune(b)
	limit := len(ar)
	if len(br) < limit {
		limit = len(br)
	}
	for i := 0; i < limit; i++ {
		ac := ar[i]
		bc := br[i]
		at := charType(ac)
		bt := charType(bc)
		if at != bt {
			if at < bt {
				return -1
			}
			return 1
		}

		acComp := ac
		bcComp := bc
		if at == 2 {
			acComp = unicode.ToLower(ac)
			bcComp = unicode.ToLower(bc)
		}
		if acComp != bcComp {
			if acComp < bcComp {
				return -1
			}
			return 1
		}

		if ac != bc {
			if ac < bc {
				return -1
			}
			return 1
		}
	}

	switch {
	case len(ar) < len(br):
		return -1
	case len(ar) > len(br):
		return 1
	default:
		return 0
	}
}

func charType(r rune) int {
	if unicode.IsLetter(r) {
		return 2
	}
	if unicode.IsDigit(r) {
		return 1
	}
	return 0
}
