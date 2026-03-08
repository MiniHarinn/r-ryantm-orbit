package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

func writeOutput(baseDir string, entries []LogEntry) error {
	const chunkSize = 512

	searchIndexPath := filepath.Join(baseDir, "search-index.json")
	lookupDir := filepath.Join(baseDir, "lookup")
	browseDateDir := filepath.Join(baseDir, "browse", "date-desc")
	browseNameDir := filepath.Join(baseDir, "browse", "name-asc")

	for _, dir := range []string{lookupDir, browseDateDir, browseNameDir} {
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
		return nameSorted[i].Package < nameSorted[j].Package
	})

	if err := writeBrowseChunks(browseDateDir, dateSorted, chunkSize); err != nil {
		return err
	}
	if err := writeBrowseChunks(browseNameDir, nameSorted, chunkSize); err != nil {
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
