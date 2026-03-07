<p align="center">
  <img src="docs/assets/images/favicon.png" alt="r-ryantm orbit icon" width="128" height="128" />
</p>

# 🪐 r-ryantm's package orbit 🪐

[![Live](https://img.shields.io/badge/live-GitHub%20Pages-0ea5e9?style=for-the-badge&logo=github)](https://miniharinn.github.io/r-ryantm-orbit/)
[![Stars](https://img.shields.io/github/stars/MiniHarinn/r-ryantm-orbit?style=for-the-badge&logo=github)](https://github.com/MiniHarinn/r-ryantm-orbit)
[![Made with Go](https://img.shields.io/badge/made%20with-Go-00ADD8?style=for-the-badge&logo=go)](https://go.dev/)

Static dashboard for r-ryantm / nixpkgs-update logs. ⚡

Designed to run on GitHub Pages or any static site host. You can find the hosted version here: https://miniharinn.github.io/r-ryantm-orbit/

## Build & data

This repo ships a small Go pipeline that fetches logs, chunks them, and builds a static site.

### Tasks (recommended)

- `task fetch`: download logs and generate `dist/index.json` + `dist/data/*`
- `task build`: build the site from existing `dist/index.json`
- `task all`: fetch + build
- `task serve`: serve `dist/` locally

### Output structure

```
dist/
  index.html
  index.json              # site index (chunks, totals, statuses, prefixes)
  data/
    entries-0001.json     # chunked entries ({ "entries": [...] })
    entries-0002.json
    ...
    prefix-aa.json        # prefix shard for search ({ "entries": [...] })
    prefix-ab.json
    ...
  logs/                   # optional: local log files if enabled
```

### Entry fields

Each entry currently includes:

```
package
date
log_url
status
old_version (optional)
new_version (optional)
error (optional)
```

## Contributing

PRs are welcome! Please use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages (e.g., `feat: ...`, `fix: ...`, `refactor: ...`).

#### Made with ❤️ by @MiniHarinn and his Codex
