package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"fast-rrytm/internal/sitegen"
)

func main() {
	opts := sitegen.Options{}
	outDir := "dist"
	chunkSize := 128
	logDir := ""

	flag.StringVar(&opts.BaseURL, "base", "https://nixpkgs-update-logs.nix-community.org/", "base URL for logs")
	flag.StringVar(&outDir, "out", outDir, "output directory")
	flag.IntVar(&opts.Workers, "workers", 16, "number of concurrent workers")
	flag.IntVar(&opts.IndexWorkers, "index-workers", 8, "concurrent workers for package indexes")
	flag.IntVar(&opts.MaxPackages, "max-packages", 0, "limit number of packages (0 = no limit)")
	flag.DurationVar(&opts.HTTPTimeout, "timeout", 45*time.Second, "HTTP timeout")
	flag.StringVar(&opts.UserAgent, "user-agent", "fast-rrytm-sitegen/1.0", "HTTP user agent")
	flag.StringVar(&logDir, "log-dir", logDir, "log output directory (default: <out>/logs, empty=skip)")
	flag.IntVar(&chunkSize, "chunk-size", chunkSize, "entries per chunk file")
	flag.BoolVar(&opts.Verbose, "verbose", false, "enable verbose logging")
	flag.Parse()

	if logDir == "" {
		logDir = filepath.Join(outDir, "logs")
	}
	opts.LogDir = logDir

	client := &http.Client{Timeout: opts.HTTPTimeout}

	payload, err := sitegen.FetchAndParse(client, opts)
	if err != nil {
		exitErr(err)
	}

	if err := sitegen.EnsureDir(outDir); err != nil {
		exitErr(err)
	}

	if _, err := sitegen.WriteChunkedData(outDir, payload, chunkSize); err != nil {
		exitErr(err)
	}
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
