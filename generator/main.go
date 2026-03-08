package main

import (
	"flag"
	"net/http"
	"runtime"
	"strings"
	"time"
)

func main() {
	baseURL := "https://nixpkgs-update-logs.nix-community.org/"
	outDir := "./generator-output"
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
