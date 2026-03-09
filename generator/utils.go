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

type Status int

const (
	StatusFailed    Status = 0
	StatusSuccess   Status = 1
	StatusSkipped   Status = 2
	StatusDuplicate Status = 3
	StatusNoChange  Status = 4
	StatusInvalid   Status = 5
	StatusOther     Status = -1
)

func statusEnum(status string) Status {
	switch status {
	case "success":
		return StatusSuccess
	case "failed":
		return StatusFailed
	case "skipped":
		return StatusSkipped
	case "duplicate":
		return StatusDuplicate
	case "no-change":
		return StatusNoChange
	case "invalid":
		return StatusInvalid
	default:
		return StatusOther
	}
}

func dateToUnix(date string) int64 {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return 0
	}
	return parsed.Unix()
}
