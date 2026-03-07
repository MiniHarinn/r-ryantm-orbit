package sitegen

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/html"
)

//go:embed templates/index.html templates/assets/*
var templateFS embed.FS

var (
	updateInfoRegex = regexp.MustCompile(`(?i)([\w.+-]+)\s+([^\s]+)\s+->\s+([^\s]+)(?:\s+https?://[^\s]+)?`) // pkg old -> new (optional url)
)

type LogTask struct {
	Package string
	Date    string
	URL     string
}

type LogEntry struct {
	Package     string `json:"package"`
	Date        string `json:"date"`
	LogURL      string `json:"log_url"`
	Status      string `json:"status"`
	OldVersion  string `json:"old_version,omitempty"`
	NewVersion  string `json:"new_version,omitempty"`
	Error       string `json:"error,omitempty"`
}

type SiteData struct {
	GeneratedAt string     `json:"generated_at"`
	Entries     []LogEntry `json:"entries"`
}

type ChunkInfo struct {
	File    string `json:"file"`
	Count   int    `json:"count"`
}

type PrefixInfo struct {
	File  string `json:"file"`
	Count int    `json:"count"`
}

type SiteIndex struct {
	GeneratedAt string         `json:"generated_at"`
	Total       int            `json:"total"`
	Statuses    map[string]int `json:"statuses"`
	Chunks      []ChunkInfo    `json:"chunks"`
	Prefixes    map[string]PrefixInfo `json:"prefixes"`
}

type SiteMeta struct {
	GeneratedAt string
	RepoStarsPrimary   string
	RepoStarsSecondary string
}

type Options struct {
	BaseURL     string
	Workers     int
	IndexWorkers int
	MaxPackages int
	HTTPTimeout time.Duration
	UserAgent   string
	LogDir      string
	Verbose     bool
}

func FetchAndParse(client *http.Client, opts Options) (SiteData, error) {
	logf(opts, "fetching package index from %s", opts.BaseURL)
	packages, err := fetchPackageList(client, opts)
	if err != nil {
		return SiteData{}, err
	}
	logf(opts, "found %d packages", len(packages))

	if opts.MaxPackages > 0 && len(packages) > opts.MaxPackages {
		packages = packages[:opts.MaxPackages]
		logf(opts, "limiting to %d packages", len(packages))
	}

	logf(opts, "building log tasks")
	tasks, err := buildTasksConcurrent(client, opts, packages)
	if err != nil {
		return SiteData{}, err
	}
	logf(opts, "queued %d log tasks", len(tasks))

	entries := fetchLogs(client, opts, tasks)
	sortEntries(entries)

	return SiteData{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Entries:     entries,
	}, nil
}

func LoadIndex(path string) (SiteIndex, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return SiteIndex{}, err
	}
	var payload SiteIndex
	if err := json.Unmarshal(data, &payload); err != nil {
		return SiteIndex{}, err
	}
	return payload, nil
}

func WriteHTML(path string, meta SiteMeta) error {
	tplData, err := templateFS.ReadFile("templates/index.html")
	if err != nil {
		return err
	}

	replacer := strings.NewReplacer(
		"{{.GeneratedAt}}", meta.GeneratedAt,
		"{{.RepoStarsPrimary}}", meta.RepoStarsPrimary,
		"{{.RepoStarsSecondary}}", meta.RepoStarsSecondary,
	)

	output := replacer.Replace(string(tplData))
	return os.WriteFile(path, []byte(output), 0o644)
}

func fetchPackageList(client *http.Client, opts Options) ([]string, error) {
	body, err := fetch(client, opts, opts.BaseURL)
	if err != nil {
		return nil, err
	}
	links, err := parseLinks(body)
	if err != nil {
		return nil, err
	}

	var packages []string
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

func buildTasksConcurrent(client *http.Client, opts Options, packages []string) ([]LogTask, error) {
	type result struct {
		tasks []LogTask
		err   error
	}

	workerCount := opts.IndexWorkers
	if workerCount < 1 {
		workerCount = opts.Workers
	}
	if workerCount < 1 {
		workerCount = 1
	}

	jobs := make(chan string)
	results := make(chan result)
	var wg sync.WaitGroup

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for pkg := range jobs {
				logf(opts, "reading index for %s", pkg)
				indexURL := fmt.Sprintf("%s%s/", opts.BaseURL, pkg)
				body, err := fetch(client, opts, indexURL)
				if err != nil {
					results <- result{err: err}
					continue
				}
				links, err := parseLinks(body)
				if err != nil {
					results <- result{err: err}
					continue
				}

				var dates []string
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
					continue
				}
				sort.Strings(dates)

				latest := dates[len(dates)-1]
				pkgTasks := []LogTask{{
					Package: pkg,
					Date:    latest,
					URL:     fmt.Sprintf("%s%s/%s.log", opts.BaseURL, pkg, latest),
				}}
				results <- result{tasks: pkgTasks}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	go func() {
		for _, pkg := range packages {
			jobs <- pkg
		}
		close(jobs)
	}()

	tasks := make([]LogTask, 0, len(packages))
	var errs []error
	for res := range results {
		if res.err != nil {
			errs = append(errs, res.err)
			continue
		}
		tasks = append(tasks, res.tasks...)
	}

	if len(errs) > 0 {
		return nil, errs[0]
	}
	return tasks, nil
}

func fetchLogs(client *http.Client, opts Options, tasks []LogTask) []LogEntry {
	jobs := make(chan LogTask)
	results := make(chan LogEntry)
	var wg sync.WaitGroup

	workerCount := opts.Workers
	if workerCount < 1 {
		workerCount = 1
	}

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for task := range jobs {
				entry := LogEntry{Package: task.Package, Date: task.Date}
				if opts.LogDir != "" {
					entry.LogURL = localLogURL(task.Package)
				} else {
					entry.LogURL = task.URL
				}
				logf(opts, "fetching log %s", task.URL)
				body, err := fetch(client, opts, task.URL)
				if err != nil {
					entry.Status = "unknown"
					entry.Error = err.Error()
					results <- entry
					continue
				}
				if opts.LogDir != "" {
					if err := writeLogFile(opts.LogDir, task.Package, body); err != nil {
						logf(opts, "failed to write log file for %s: %v", task.Package, err)
					}
				}

				parseLog(body, &entry)
				results <- entry
			}
		}()
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	go func() {
		for _, task := range tasks {
			jobs <- task
		}
		close(jobs)
	}()

	entries := make([]LogEntry, 0, len(tasks))
	for entry := range results {
		entries = append(entries, entry)
	}
	return entries
}

func parseLog(body []byte, entry *LogEntry) {
	text := strings.ReplaceAll(string(body), "\r\n", "\n")

	entry.Status = deriveStatus(text)
	if entry.Status == "failed" {
		entry.Error = deriveError(strings.Split(text, "\n"))
	}

	if match := updateInfoRegex.FindStringSubmatch(text); len(match) == 4 {
		entry.OldVersion = match[2]
		entry.NewVersion = match[3]
	}

}

func localLogURL(pkg string) string {
	return path.Join("logs", fmt.Sprintf("%s.log", pkg))
}

func writeLogFile(dir string, pkg string, body []byte) error {
	if dir == "" {
		return nil
	}
	if !isSafePathSegment(pkg) {
		return fmt.Errorf("unsafe package path: %s", pkg)
	}
	if err := EnsureDir(dir); err != nil {
		return err
	}
	filename := fmt.Sprintf("%s.log", pkg)
	path := filepath.Join(dir, filename)
	return os.WriteFile(path, body, 0o644)
}

func isSafePathSegment(value string) bool {
	if value == "" {
		return false
	}
	if strings.Contains(value, "/") || strings.Contains(value, "\\") {
		return false
	}
	if strings.Contains(value, "..") {
		return false
	}
	return true
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

func sortEntries(entries []LogEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Date == entries[j].Date {
			return entries[i].Package < entries[j].Package
		}
		return entries[i].Date > entries[j].Date
	})
}

func fetch(client *http.Client, opts Options, url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", opts.UserAgent)

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

func logf(opts Options, format string, args ...any) {
	if !opts.Verbose {
		return
	}
	fmt.Fprintf(os.Stderr, "verbose: "+format+"\n", args...)
}

func parseLinks(body []byte) ([]string, error) {
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	var links []string
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

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func WriteSite(path string, meta SiteMeta) error {
	if err := EnsureDir(path); err != nil {
		return err
	}
	if err := writeAssets(path); err != nil {
		return err
	}
	return WriteHTML(pathJoin(path, "index.html"), meta)
}

func pathJoin(dir, file string) string {
	return path.Join(dir, file)
}

func writeAssets(dir string) error {
	assetsDir := "templates/assets"
	entries, err := fs.ReadDir(templateFS, assetsDir)
	if err != nil {
		return err
	}
	outputDir := pathJoin(dir, "assets")
	if err := EnsureDir(outputDir); err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		data, err := templateFS.ReadFile(path.Join(assetsDir, name))
		if err != nil {
			return err
		}
		if err := os.WriteFile(pathJoin(outputDir, name), data, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func WriteChunkedData(dir string, payload SiteData, chunkSize int) (SiteIndex, error) {
	if chunkSize < 1 {
		chunkSize = 500
	}
	if err := EnsureDir(dir); err != nil {
		return SiteIndex{}, err
	}
	dataDir := pathJoin(dir, "data")
	if err := EnsureDir(dataDir); err != nil {
		return SiteIndex{}, err
	}

	statuses := map[string]int{}
	for _, entry := range payload.Entries {
		statuses[entry.Status]++
	}

	var chunks []ChunkInfo
	for i := 0; i < len(payload.Entries); i += chunkSize {
		end := i + chunkSize
		if end > len(payload.Entries) {
			end = len(payload.Entries)
		}
		chunkEntries := payload.Entries[i:end]
		file := path.Join("data", fmt.Sprintf("entries-%04d.json", len(chunks)+1))
		chunkPath := pathJoin(dir, file)
		chunkPayload := struct {
			Entries []LogEntry `json:"entries"`
		}{Entries: chunkEntries}
		data, err := json.MarshalIndent(chunkPayload, "", "  ")
		if err != nil {
			return SiteIndex{}, err
		}
		if err := os.WriteFile(chunkPath, data, 0o644); err != nil {
			return SiteIndex{}, err
		}

		info := ChunkInfo{File: file, Count: len(chunkEntries)}
		chunks = append(chunks, info)
	}

	prefixes := map[string][]LogEntry{}
	for _, entry := range payload.Entries {
		key := prefixKey(entry.Package)
		prefixes[key] = append(prefixes[key], entry)
	}

	prefixIndex := map[string]PrefixInfo{}
	if len(prefixes) > 0 {
		keys := make([]string, 0, len(prefixes))
		for key := range prefixes {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			entries := prefixes[key]
			file := path.Join("data", fmt.Sprintf("prefix-%s.json", key))
			chunkPayload := struct {
				Entries []LogEntry `json:"entries"`
			}{Entries: entries}
			data, err := json.MarshalIndent(chunkPayload, "", "  ")
			if err != nil {
				return SiteIndex{}, err
			}
			if err := os.WriteFile(pathJoin(dir, file), data, 0o644); err != nil {
				return SiteIndex{}, err
			}
			prefixIndex[key] = PrefixInfo{File: file, Count: len(entries)}
		}
	}

	index := SiteIndex{
		GeneratedAt: payload.GeneratedAt,
		Total:       len(payload.Entries),
		Statuses:    statuses,
		Chunks:      chunks,
		Prefixes:    prefixIndex,
	}

	indexData, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return SiteIndex{}, err
	}
	if err := os.WriteFile(pathJoin(dir, "index.json"), indexData, 0o644); err != nil {
		return SiteIndex{}, err
	}
	return index, nil
}

func prefixKey(value string) string {
	lower := strings.ToLower(value)
	var letters []rune
	for _, r := range lower {
		if r >= 'a' && r <= 'z' {
			letters = append(letters, r)
			if len(letters) == 2 {
				break
			}
			continue
		}
		if len(letters) > 0 {
			break
		}
	}
	if len(letters) == 2 {
		return string(letters)
	}
	if len(letters) == 1 {
		return string(letters) + "_"
	}
	return "other"
}
