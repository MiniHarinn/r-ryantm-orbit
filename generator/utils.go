package main

import (
	"fmt"
	"os"
	"time"
)

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "log: "+format+"\n", args...)
}

const (
	StatusFailed         = 0
	StatusSuccess        = 1
	StatusOptedOut       = 2
	StatusAlreadyUpdated = 3
	StatusUnknown        = -1
)

func statusEnum(status string) int {
	switch status {
	case "success":
		return StatusSuccess
	case "failed":
		return StatusFailed
	case "opted-out":
		return StatusOptedOut
	case "already-updated":
		return StatusAlreadyUpdated
	default:
		return StatusUnknown
	}
}

func dateToUnix(date string) int64 {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return 0
	}
	return parsed.Unix()
}
