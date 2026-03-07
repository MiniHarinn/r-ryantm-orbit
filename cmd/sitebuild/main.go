package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"fast-rrytm/internal/sitegen"
)

const (
	repoPrimary   = "NixOS/nixpkgs"
	repoSecondary = "MiniHarinn/r-ryantm-orbit"
)

type repoResponse struct {
	Stars int `json:"stargazers_count"`
}

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
	client := &http.Client{Timeout: 8 * time.Second}
	primaryStars, err := fetchRepoStars(client, repoPrimary)
	if err != nil && verbose {
		fmt.Fprintln(os.Stderr, "verbose: failed to fetch stars for", repoPrimary, err)
	}
	secondaryStars, err := fetchRepoStars(client, repoSecondary)
	if err != nil && verbose {
		fmt.Fprintln(os.Stderr, "verbose: failed to fetch stars for", repoSecondary, err)
	}

	meta := sitegen.SiteMeta{
		GeneratedAt:        index.GeneratedAt,
		RepoStarsPrimary:   formatStars(primaryStars),
		RepoStarsSecondary: formatStars(secondaryStars),
	}
	if err := sitegen.WriteSite(outDir, meta); err != nil {
		exitErr(err)
	}
}

func fetchRepoStars(client *http.Client, repo string) (int, error) {
	req, err := http.NewRequest(http.MethodGet, "https://api.github.com/repos/"+repo, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "fast-rrytm-sitebuild/1.0")
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("unexpected status: %s", resp.Status)
	}
	var payload repoResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, err
	}
	return payload.Stars, nil
}

func formatStars(value int) string {
	if value < 0 {
		return "--"
	}
	return fmt.Sprintf("%d", value)
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
