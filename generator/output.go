package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
)

func writeOutput(baseDir string, entries []LogEntry) error {
	const chunkSize = 512

	searchIndexPath := filepath.Join(baseDir, "search-index.json")
	lookupDir := filepath.Join(baseDir, "lookup")
	browseDateDir := filepath.Join(baseDir, "browse", "date-desc")
	browseDateAscDir := filepath.Join(baseDir, "browse", "date-asc")
	browseNameDir := filepath.Join(baseDir, "browse", "name-asc")
	browseNameDescDir := filepath.Join(baseDir, "browse", "name-desc")

	for _, dir := range []string{lookupDir, browseDateDir, browseDateAscDir, browseNameDir, browseNameDescDir} {
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

	dateSorted := append([]LogEntry(nil), entries...)
	sort.Slice(dateSorted, func(i, j int) bool {
		if dateSorted[i].Date == dateSorted[j].Date {
			return dateSorted[i].Package < dateSorted[j].Package
		}
		return dateSorted[i].Date > dateSorted[j].Date
	})

	nameSorted := append([]LogEntry(nil), entries...)
	sort.Slice(nameSorted, func(i, j int) bool {
		if nameSorted[i].Package == nameSorted[j].Package {
			return nameSorted[i].Date > nameSorted[j].Date
		}
		return comparePackageName(nameSorted[i].Package, nameSorted[j].Package) < 0
	})

	if err := writeBrowseChunks(browseDateDir, dateSorted, chunkSize); err != nil {
		return err
	}
	dateAsc := append([]LogEntry(nil), entries...)
	sort.Slice(dateAsc, func(i, j int) bool {
		if dateAsc[i].Date == dateAsc[j].Date {
			return dateAsc[i].Package < dateAsc[j].Package
		}
		return dateAsc[i].Date < dateAsc[j].Date
	})
	if err := writeBrowseChunks(browseDateAscDir, dateAsc, chunkSize); err != nil {
		return err
	}
	if err := writeBrowseChunks(browseNameDir, nameSorted, chunkSize); err != nil {
		return err
	}
	nameDesc := append([]LogEntry(nil), entries...)
	sort.Slice(nameDesc, func(i, j int) bool {
		if nameDesc[i].Package == nameDesc[j].Package {
			return nameDesc[i].Date > nameDesc[j].Date
		}
		return comparePackageName(nameDesc[i].Package, nameDesc[j].Package) > 0
	})
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
	if chunkSize < 1 {
		chunkSize = 100
	}
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
			acComp = []rune(strings.ToLower(string(ac)))[0]
			bcComp = []rune(strings.ToLower(string(bc)))[0]
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
