package main

import (
	"flag"
	"fmt"
	"os"

	"fast-rrytm/internal/sitegen"
)

func main() {
	outDir := "dist"
	dataPath := "dist/index.json"
	verbose := false

	flag.StringVar(&outDir, "out", outDir, "output directory")
	flag.StringVar(&dataPath, "data", dataPath, "data JSON path")
	flag.BoolVar(&verbose, "verbose", false, "enable verbose logging")
	flag.Parse()

	if verbose {
		fmt.Fprintln(os.Stderr, "verbose: loading index", dataPath)
	}

	index, err := sitegen.LoadIndex(dataPath)
	if err != nil {
		exitErr(err)
	}

	if err := sitegen.EnsureDir(outDir); err != nil {
		exitErr(err)
	}

	if verbose {
		fmt.Fprintln(os.Stderr, "verbose: writing site to", outDir)
	}
	meta := sitegen.SiteMeta{
		GeneratedAt: index.GeneratedAt,
		BaseURL:     index.BaseURL,
		Mode:        index.Mode,
	}
	if err := sitegen.WriteSite(outDir, meta); err != nil {
		exitErr(err)
	}
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
