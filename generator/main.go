package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"golang.org/x/net/html"
)

type LogEntry struct {
	ID      int
	Package string
	Date    int64
	Status  int
	Error   string
}

func main() {
	baseURL := "https://nixpkgs-update-logs.nix-community.org/"
	outDir := "../output"
	timeout := 45 * time.Second
	workers := runtime.NumCPU() * 6

	flag.StringVar(&baseURL, "base", baseURL, "base URL for logs")
	flag.StringVar(&outDir, "out", outDir, "output data directory")
	flag.DurationVar(&timeout, "timeout", timeout, "HTTP timeout")
	flag.IntVar(&workers, "workers", workers, "number of concurrent workers")
	flag.Parse()

	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}

	client := &http.Client{Timeout: timeout}

	logf("fetching package index from %s", baseURL)
	packages, err := fetchPackageList(client, baseURL)
	if err != nil {
		exitErr(err)
	}
	logf("found %d packages", len(packages))

	entries, err := fetchEntriesConcurrent(client, baseURL, packages, workers)
	if err != nil {
		exitErr(err)
	}

	for i := range entries {
		entries[i].ID = i + 1
	}

	logf("writing output to %s", outDir)
	if err := writeOutput(outDir, entries); err != nil {
		exitErr(err)
	}
	logf("done")
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

func fetchEntriesConcurrent(client *http.Client, baseURL string, packages []string, workers int) ([]LogEntry, error) {
	if workers < 1 {
		workers = 1
	}

	type job struct {
		index       int
		packageName string
	}
	type result struct {
		index int
		entry *LogEntry
		err   error
	}

	jobs := make(chan job)
	results := make(chan result)

	for i := 0; i < workers; i++ {
		go func() {
			for j := range jobs {
				if j.index%200 == 0 {
					logf("processing package %d/%d", j.index+1, len(packages))
				}
				latest, err := fetchLatestDate(client, baseURL, j.packageName)
				if err != nil {
					results <- result{index: j.index, err: err}
					continue
				}
				if latest == "" {
					results <- result{index: j.index, entry: nil}
					continue
				}

				logURL := fmt.Sprintf("%s%s/%s.log", baseURL, j.packageName, latest)
				body, err := fetch(client, logURL)
				entry := LogEntry{
					Package: j.packageName,
					Date:    dateToUnix(latest),
					Status:  statusEnum("unknown"),
					Error:   "",
				}
				if err == nil {
					text := string(body)
					entry.Status = statusEnum(deriveStatus(text))
					if entry.Status == statusEnum("failed") {
						entry.Error = deriveError(strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n"))
					}
				}

				results <- result{index: j.index, entry: &entry}
			}
		}()
	}

	go func() {
		for i, pkg := range packages {
			jobs <- job{index: i, packageName: pkg}
		}
		close(jobs)
	}()

	collected := make([]*LogEntry, len(packages))
	for i := 0; i < len(packages); i++ {
		res := <-results
		if res.err != nil {
			return nil, res.err
		}
		if res.entry != nil {
			collected[res.index] = res.entry
		}
	}

	entries := make([]LogEntry, 0, len(packages))
	for _, entry := range collected {
		if entry != nil {
			entries = append(entries, *entry)
		}
	}
	return entries, nil
}

func fetchPackageList(client *http.Client, baseURL string) ([]string, error) {
	body, err := fetch(client, baseURL)
	if err != nil {
		return nil, err
	}
	links, err := parseLinks(body)
	if err != nil {
		return nil, err
	}

	packages := make([]string, 0, len(links))
	for _, link := range links {
		if link == "../" {
			continue
		}
		if strings.HasSuffix(link, "/") {
			packages = append(packages, strings.TrimSuffix(link, "/"))
		}
	}

	sort.Strings(packages)
	return packages, nil
}

func fetchLatestDate(client *http.Client, baseURL, pkg string) (string, error) {
	indexURL := fmt.Sprintf("%s%s/", baseURL, pkg)
	body, err := fetch(client, indexURL)
	if err != nil {
		return "", err
	}
	links, err := parseLinks(body)
	if err != nil {
		return "", err
	}

	dates := make([]string, 0)
	for _, link := range links {
		if !strings.HasSuffix(link, ".log") {
			continue
		}
		date := strings.TrimSuffix(link, ".log")
		if _, err := time.Parse("2006-01-02", date); err != nil {
			continue
		}
		dates = append(dates, date)
	}

	if len(dates) == 0 {
		return "", nil
	}
	sort.Strings(dates)
	return dates[len(dates)-1], nil
}

func deriveStatus(text string) string {
	lower := strings.ToLower(text)

	switch {
	case strings.Contains(lower, "[result] success updating") ||
		strings.Contains(lower, "successfully finished processing"):
		return "success"
	case strings.Contains(lower, "derivation file opts-out of auto-updates") ||
		strings.Contains(lower, "nixpkgs-update: no auto update") ||
		strings.Contains(lower, "opts out of auto-updates") ||
		strings.Contains(lower, "opts-out of auto-updates"):
		return "opted-out"
	case strings.Contains(lower, "auto update branch exists with an equal or greater version") ||
		strings.Contains(lower, "auto update branch exists with an equal or greater"):
		return "already-updated"
	case strings.Contains(lower, "[result] failed to update"):
		return "failed"
	case strings.Contains(lower, "error:") ||
		strings.Contains(lower, "failed with exit code") ||
		strings.Contains(lower, "build failed") ||
		strings.Contains(lower, "dependency failed") ||
		strings.Contains(lower, "cannot build") ||
		strings.Contains(lower, "failed to build") ||
		strings.Contains(lower, "failed to download"):
		return "failed"
	default:
		return "unknown"
	}
}

func deriveError(lines []string) string {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		if strings.Contains(lower, "error:") || strings.Contains(lower, "failed") {
			if len(trimmed) > 240 {
				return trimmed[:240] + "..."
			}
			return trimmed
		}
	}
	return ""
}

func fetch(client *http.Client, url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "r-ryantm-orbit-generator/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d for %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func parseLinks(body []byte) ([]string, error) {
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	links := make([]string, 0)
	var walker func(*html.Node)
	walker = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "a" {
			for _, attr := range node.Attr {
				if attr.Key == "href" {
					links = append(links, attr.Val)
					break
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walker(child)
		}
	}
	walker(doc)
	if len(links) == 0 {
		return nil, errors.New("no links found in index")
	}
	return links, nil
}

func statusEnum(status string) int {
	switch status {
	case "success":
		return 1
	case "failed":
		return 0
	case "opted-out":
		return 2
	case "already-updated":
		return 3
	default:
		return -1
	}
}

func dateToUnix(date string) int64 {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return 0
	}
	return parsed.Unix()
}

func writeOutput(baseDir string, entries []LogEntry) error {
	const chunkSize = 100

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

	for i, entry := range entries {
		lookupChunk := (len(lookupRows) / chunkSize) + 1
		errorValue := errorField(entry.Error)
		searchIndexRows = append(searchIndexRows, []any{entry.ID, entry.Package, entry.Status, entry.Date, lookupChunk})
		lookupRows = append(lookupRows, []any{entry.ID, entry.Package, entry.Status, entry.Date, errorValue})
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

func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "log: "+format+"\n", args...)
}

func writeBrowseChunks(dir string, entries []LogEntry, chunkSize int) error {
	rows := make([][]any, 0, len(entries))
	for _, entry := range entries {
		rows = append(rows, []any{entry.ID, entry.Package, entry.Status, entry.Date, errorField(entry.Error)})
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
