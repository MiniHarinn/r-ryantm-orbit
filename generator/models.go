package main

type LogEntry struct {
	ID      int
	Package string
	Date    int64
	Status  Status
	OldVer  string
	NewVer  string
	Error   string
}
