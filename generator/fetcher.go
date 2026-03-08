package main

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

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
	results := make(chan result, len(packages))

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
					Status:  StatusUnknown,
					OldVer:  "",
					NewVer:  "",
					Error:   "",
				}
				if err == nil {
					text := string(body)
					oldVer, newVer := deriveVersions(text, j.packageName)
					entry.OldVer = oldVer
					entry.NewVer = newVer
					entry.Status = statusEnum(deriveStatus(text))
					if entry.Status == StatusFailed {
						entry.Error = deriveError(text)
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
