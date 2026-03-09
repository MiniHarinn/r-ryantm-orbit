package main

import (
	"regexp"
	"strings"
)

var (
	updateInfoRE = regexp.MustCompile(`UPDATE_INFO:\s+\S+\s+([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)\s*->\s*([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)

	statusSuccessRE = []*regexp.Regexp{
		regexp.MustCompile(`(?i)successfully finished processing`),
	}
	statusSkippedRE = []*regexp.Regexp{
		regexp.MustCompile(`(?i)derivation file opts?-out of auto-updates`),
	}
	statusDuplicateRE = []*regexp.Regexp{
		regexp.MustCompile(`(?i)auto update branch exists with an equal or greater version`),
		regexp.MustCompile(`(?i)there might already be an open PR for this update:`),
		regexp.MustCompile(`(?i)too many open PRs from`),
	}
	statusNoChangeRE = []*regexp.Regexp{
		regexp.MustCompile(`(?i)diff was empty after rewrites\.`),
		regexp.MustCompile(`(?i)no rewrites performed on derivation\.`),
		regexp.MustCompile(`(?i)source url did not change`),
		regexp.MustCompile(`(?i)hashes equal; no update necessary`),
		regexp.MustCompile(`(?i)rev equal; no update necessary`),
		regexp.MustCompile(`(?i)package version did not change\.`),
		regexp.MustCompile(`(?i)update edits cause no rebuilds\.`),
		regexp.MustCompile(`(?i)cargo hashes equal; no update necessary:`),
		regexp.MustCompile(`(?i)deps hashes equal; no update necessary:`),
	}
	statusInvalidRE = []*regexp.Regexp{
		regexp.MustCompile(`(?i)is not newer than .* according to Nix; versionComparison:`),
		regexp.MustCompile(`(?i)derivation has no 'version' attribute, so do not know how to figure out the version while doing an updateScript update`),
		regexp.MustCompile(`(?i)old version .* not present in .* derivation file with contents:`),
	}
	statusFailedRE = []*regexp.Regexp{
		// ===== nixpkgs-update messages =====
		regexp.MustCompile(`(?i)\[updateScript\]\s+failed with exit code`),
		regexp.MustCompile(`(?i)nix build failed\.`),
		regexp.MustCompile(`(?i)nix log failed trying to get build logs`),
		regexp.MustCompile(`(?i)could not find result link`),
		regexp.MustCompile(`(?i)build succeeded unexpectedly`),
		regexp.MustCompile(`(?i)grep did not find version in file names`),
		regexp.MustCompile(`(?i)failed to read expected nix boolean`),
		// ===== nix stderr =====
		regexp.MustCompile(`(?im)^error:`),
		regexp.MustCompile(`(?i)builder for '.+?\\.drv' failed with exit code`),
		regexp.MustCompile(`(?i)build of '.+?\\.drv'.+failed`),
	}
)

func deriveStatus(text string) string {
	if matchesAny(text, statusSuccessRE) {
		return "success"
	}
	if matchesAny(text, statusSkippedRE) {
		return "skipped"
	}
	if matchesAny(text, statusDuplicateRE) {
		return "duplicate"
	}
	if matchesAny(text, statusNoChangeRE) {
		return "no-change"
	}
	if matchesAny(text, statusInvalidRE) {
		return "invalid"
	}
	if matchesAny(text, statusFailedRE) {
		return "failed"
	}
	return "other"
}

func deriveVersions(text, pkg string) (string, string) {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	for _, line := range lines {
		oldVer, newVer, ok := parseUpdateInfo(line)
		if ok {
			return oldVer, newVer
		}
	}
	return "", ""
}

func matchesAny(text string, patterns []*regexp.Regexp) bool {
	for _, re := range patterns {
		if re.MatchString(text) {
			return true
		}
	}
	return false
}

func parseUpdateInfo(line string) (string, string, bool) {
	if !strings.Contains(line, "UPDATE_INFO:") {
		return "", "", false
	}
	match := updateInfoRE.FindStringSubmatch(line)
	if len(match) < 3 {
		return "", "", false
	}
	if strings.Contains(match[1], "/") || strings.Contains(match[2], "/") {
		return "", "", false
	}
	return match[1], match[2], true
}
