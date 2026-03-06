package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"fast-rrytm/internal/sitegen"
)

func main() {
	outDir := "dist"
	dataPath := "dist/data.json"
	verbose := false

	flag.StringVar(&outDir, "out", outDir, "output directory")
	flag.StringVar(&dataPath, "data", dataPath, "data JSON path")
	flag.BoolVar(&verbose, "verbose", false, "enable verbose logging")
	flag.Parse()

	if verbose {
		fmt.Fprintln(os.Stderr, "verbose: loading data", dataPath)
	}

	payload, err := sitegen.LoadData(dataPath)
	if err != nil {
		exitErr(err)
	}

	if err := sitegen.EnsureDir(outDir); err != nil {
		exitErr(err)
	}

	if verbose {
		fmt.Fprintln(os.Stderr, "verbose: writing site to", outDir)
	}
	if err := sitegen.WriteHTML(filepath.Join(outDir, "index.html"), payload); err != nil {
		exitErr(err)
	}
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
