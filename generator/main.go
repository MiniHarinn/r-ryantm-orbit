package main

import (
	"context"
	"flag"
	"net/http"
	"runtime"
	"strings"
	"time"
)

type Config struct {
	BaseURL   string
	OutDir    string
	Timeout   time.Duration
	Workers   int
	ChunkSize int
}

func main() {
	cfg := parseFlags()

	client := &http.Client{Timeout: cfg.Timeout}
	ctx := context.Background()

	logf("fetching package index from %s", cfg.BaseURL)
	packages, err := fetchPackageList(ctx, client, cfg.BaseURL)
	if err != nil {
		exitErr(err)
	}
	logf("found %d packages", len(packages))

	entries, err := fetchEntriesConcurrent(ctx, client, cfg.BaseURL, packages, cfg.Workers)
	if err != nil {
		exitErr(err)
	}

	for i := range entries {
		entries[i].ID = i + 1
	}

	logf("writing output to %s", cfg.OutDir)
	if err := writeOutput(cfg.OutDir, entries, cfg.ChunkSize); err != nil {
		exitErr(err)
	}
	logf("done")
}

func parseFlags() Config {
	cfg := Config{
		BaseURL:   "https://nixpkgs-update-logs.nix-community.org/",
		OutDir:    "./generator-output",
		Timeout:   45 * time.Second,
		Workers:   runtime.NumCPU() * 6,
		ChunkSize: 128,
	}

	flag.StringVar(&cfg.BaseURL, "base", cfg.BaseURL, "base URL for logs")
	flag.StringVar(&cfg.OutDir, "out", cfg.OutDir, "output data directory")
	flag.DurationVar(&cfg.Timeout, "timeout", cfg.Timeout, "HTTP timeout")
	flag.IntVar(&cfg.Workers, "workers", cfg.Workers, "number of concurrent workers")
	flag.IntVar(&cfg.ChunkSize, "chunk-size", cfg.ChunkSize, "items per chunk for output files")
	flag.Parse()

	if !strings.HasSuffix(cfg.BaseURL, "/") {
		cfg.BaseURL += "/"
	}

	return cfg
}
