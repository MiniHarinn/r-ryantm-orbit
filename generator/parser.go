package main

import (
	"regexp"
	"strings"
)

var (
	updateInfoRE      = regexp.MustCompile(`UPDATE_INFO:\s+\S+\s+([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)\s*->\s*([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)
	versionArrowRE    = regexp.MustCompile(`(?i)([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)\s*(?:->|=>|→)\s*([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)
	versionFromToRE   = regexp.MustCompile(`(?i)from\s+([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)\s+to\s+([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)
	versionLabelOldRE = regexp.MustCompile(`(?i)(?:current|old|previous)\s*version\s*[:=]\s*([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)
	versionLabelNewRE = regexp.MustCompile(`(?i)(?:new|latest|next)\s*version\s*[:=]\s*([0-9a-zA-Z][0-9a-zA-Z.+~_-]*)`)
)

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

func deriveError(text string) string {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
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

func deriveVersions(text, pkg string) (string, string) {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	for _, line := range lines {
		oldVer, newVer, ok := parseUpdateInfo(line)
		if ok {
			return oldVer, newVer
		}
		oldVer, newVer, ok = parseVersionFromTo(line, pkg)
		if ok {
			return oldVer, newVer
		}
		oldVer, newVer, ok = parseVersionArrow(line, pkg)
		if ok {
			return oldVer, newVer
		}
	}

	var oldVer string
	var newVer string
	for _, line := range lines {
		if oldVer == "" {
			oldVer = parseVersionLabel(line, versionLabelOldRE)
		}
		if newVer == "" {
			newVer = parseVersionLabel(line, versionLabelNewRE)
		}
		if oldVer != "" && newVer != "" {
			return oldVer, newVer
		}
	}

	return "", ""
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

func parseVersionArrow(line, pkg string) (string, string, bool) {
	lower := strings.ToLower(line)
	if !strings.Contains(lower, "->") && !strings.Contains(lower, "=>") {
		return "", "", false
	}
	if pkg != "" && !strings.Contains(lower, strings.ToLower(pkg)) && !strings.Contains(lower, "version") {
		return "", "", false
	}

	match := versionArrowRE.FindStringSubmatch(line)
	if len(match) < 3 {
		return "", "", false
	}
	if strings.Contains(match[1], "/") || strings.Contains(match[2], "/") {
		return "", "", false
	}
	return match[1], match[2], true
}

func parseVersionFromTo(line, pkg string) (string, string, bool) {
	lower := strings.ToLower(line)
	if !strings.Contains(lower, "from") || !strings.Contains(lower, "to") {
		return "", "", false
	}
	if pkg != "" && !strings.Contains(lower, strings.ToLower(pkg)) && !strings.Contains(lower, "version") {
		return "", "", false
	}

	match := versionFromToRE.FindStringSubmatch(line)
	if len(match) < 3 {
		return "", "", false
	}
	if strings.Contains(match[1], "/") || strings.Contains(match[2], "/") {
		return "", "", false
	}
	return match[1], match[2], true
}

func parseVersionLabel(line string, re *regexp.Regexp) string {
	match := re.FindStringSubmatch(line)
	if len(match) < 2 {
		return ""
	}
	if strings.Contains(match[1], "/") {
		return ""
	}
	return match[1]
}
