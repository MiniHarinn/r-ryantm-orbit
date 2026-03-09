package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"golang.org/x/net/html"
)

func fetch(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "r-ryantm-orbit-generator/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d for %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func parseLinks(body []byte) ([]string, error) {
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	links := make([]string, 0)
	var walker func(*html.Node)
	walker = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "a" {
			for _, attr := range node.Attr {
				if attr.Key == "href" {
					links = append(links, attr.Val)
					break
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walker(child)
		}
	}
	walker(doc)
	if len(links) == 0 {
		return nil, errors.New("no links found in index")
	}
	return links, nil
}

var indexTimestampRE = regexp.MustCompile(`(?s)<a\s+href="([^"]+\.log)".*?</a>\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}:\d{2})`)

func parseIndexTimestamps(body []byte) map[string]time.Time {
	matches := indexTimestampRE.FindAllSubmatch(body, -1)
	if len(matches) == 0 {
		return map[string]time.Time{}
	}
	timestamps := make(map[string]time.Time, len(matches))
	for _, match := range matches {
		if len(match) < 4 {
			continue
		}
		filename := string(match[1])
		dateStr := string(match[2])
		timeStr := string(match[3])
		parsed, err := time.ParseInLocation("02-Jan-2006 15:04", dateStr+" "+timeStr, time.UTC)
		if err != nil {
			continue
		}
		timestamps[filename] = parsed
	}
	return timestamps
}
