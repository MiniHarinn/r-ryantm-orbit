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

func statusEnum(status string) int {
	switch status {
	case "success":
		return 1
	case "failed":
		return 0
	case "opted-out":
		return 2
	case "already-updated":
		return 3
	default:
		return -1
	}
}

func dateToUnix(date string) int64 {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return 0
	}
	return parsed.Unix()
}
