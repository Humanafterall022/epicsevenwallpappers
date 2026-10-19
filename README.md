# Epic Seven Wallpaper Scraper

A lightweight, zero-dependency Node.js CLI tool to scrape and download official wallpapers and animated lobby videos from [e7codex.com](https://e7codex.com/#/wallpapers).

---

## Features

- **Zero External Dependencies**: Built with native Node.js (18+) APIs (`fetch`, `node:fs/promises`, `node:stream/promises`, and `node:util.parseArgs`).
- **Complete Catalog**:
  - **708 static wallpapers** (PNG format) across 4 categories: `lobby`, `event`, `episode`, `story`.
  - **24 animated lobby wallpapers** (WebM video format) + high-res poster stills.
- **Smart Resume**: Detects existing files on disk and automatically skips them to save bandwidth and resume interrupted downloads.
- **Concurrent Workers**: Configurable parallel download queue (defaults to 6 concurrent streams).
- **Categorized Storage**: Organizes files into dedicated folders (`lobby/`, `event/`, `episode/`, `story/`, `animated/`).
- **Rich Metadata Export**: Automatically generates a structured `metadata.json` catalog containing official names, stems, categories, character links, and source URLs.
- **Dry-run Mode**: Inspect items without downloading.

---

## Requirements

- **Node.js**: `v18.0.0` or higher (verified on Node v24).
- No `npm install` needed!

---

## Quick Start

### 1. Download all wallpapers and animations
```bash
npm start
```
*Or directly via Node:*
```bash
node src/index.js
```

### 2. Dry run (preview without downloading)
```bash
npm run dry-run
# or
node src/index.js --dry-run
```

---

## CLI Options & Usage

```bash
node src/index.js [options]
```

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--output <dir>` | `-o` | `./wallpapers` | Target destination directory for wallpapers. |
| `--category <cat>` | `-c` | `all` | Filter by category (`lobby`, `event`, `episode`, `story`, `animated`, `all`). |
| `--concurrency <n>` | `-j` | `6` | Number of simultaneous download connections. |
| `--skip-animated` | | `false` | Exclude animated WebM wallpapers and only download static PNGs. |
| `--force` | | `false` | Re-download and overwrite files even if they already exist locally. |
| `--dry-run` | | `false` | Display catalog statistics and preview items without downloading. |
| `--help` | `-h` | `false` | Display help guide and available options. |

---

## Examples

### Download only Lobby wallpapers:
```bash
node src/index.js --category lobby
```

### Download only animated lobby scenes:
```bash
node src/index.js --category animated
```

### Download only static wallpapers (no videos):
```bash
node src/index.js --skip-animated
```

### Save to a custom directory with 10 concurrent streams:
```bash
node src/index.js -o "D:/My Wallpapers/Epic Seven" -j 10
```

---

## Directory Structure

When running, the scraper creates the following structure inside your destination folder:

```text
wallpapers/
├── metadata.json
├── lobby/
│   ├── bg_base_old.png
│   ├── lobby_bg1.png
│   └── ...
├── event/
│   ├── lp_2023summer_bg.png
│   └── ...
├── episode/
│   ├── ep1_ch1_bg.png
│   └── ...
├── story/
│   ├── bg_story_01.png
│   └── ...
└── animated/
    ├── bgeff_epic_dash_2026.webm
    ├── bgeff_epic_dash_2026.jpg
    └── ...
```

---

## License

MIT License.
