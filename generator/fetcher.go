package main

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

func fetchEntriesConcurrent(ctx context.Context, client *http.Client, baseURL string, packages []string, workers int) ([]LogEntry, error) {
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

	const progressEvery = 200
	jobs := make(chan job)
	results := make(chan result, workers*2)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				if j.index%progressEvery == 0 {
					logf("processing package %d/%d", j.index+1, len(packages))
				}
				latest, err := fetchLatestDate(ctx, client, baseURL, j.packageName)
				if err != nil {
					select {
					case results <- result{index: j.index, err: err}:
					case <-ctx.Done():
					}
					continue
				}
				if latest == "" {
					select {
					case results <- result{index: j.index, entry: nil}:
					case <-ctx.Done():
					}
					continue
				}

				logURL := fmt.Sprintf("%s%s/%s.log", baseURL, j.packageName, latest)
				body, err := fetch(ctx, client, logURL)
				entry := LogEntry{
					Package: j.packageName,
					Date:    dateToUnix(latest),
					Status:  StatusOther,
					OldVer:  "",
					NewVer:  "",
				}
				if err == nil {
					text := string(body)
					oldVer, newVer := deriveVersions(text, j.packageName)
					entry.OldVer = oldVer
					entry.NewVer = newVer
					entry.Status = statusEnum(deriveStatus(text))
				}

				select {
				case results <- result{index: j.index, entry: &entry}:
				case <-ctx.Done():
				}
			}
		}()
	}

	go func() {
		for i, pkg := range packages {
			select {
			case jobs <- job{index: i, packageName: pkg}:
			case <-ctx.Done():
				close(jobs)
				return
			}
		}
		close(jobs)
	}()

	go func() {
		wg.Wait()
		close(results)
	}()

	collected := make([]*LogEntry, len(packages))
	var firstErr error
	for res := range results {
		if res.err != nil {
			if firstErr == nil {
				firstErr = res.err
				cancel()
			}
			continue
		}
		if res.entry != nil {
			collected[res.index] = res.entry
		}
	}
	if firstErr != nil {
		return nil, firstErr
	}

	entries := make([]LogEntry, 0, len(packages))
	for _, entry := range collected {
		if entry != nil {
			entries = append(entries, *entry)
		}
	}
	return entries, nil
}

func fetchPackageList(ctx context.Context, client *http.Client, baseURL string) ([]string, error) {
	body, err := fetch(ctx, client, baseURL)
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

func fetchLatestDate(ctx context.Context, client *http.Client, baseURL, pkg string) (string, error) {
	indexURL := fmt.Sprintf("%s%s/", baseURL, pkg)
	body, err := fetch(ctx, client, indexURL)
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
