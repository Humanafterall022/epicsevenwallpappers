#!/usr/bin/env node

import { parseArgs } from 'node:util';
import path from 'node:path';
import { loadCatalog } from './api.js';
import { downloadCatalog, formatBytes } from './downloader.js';

const HELP_TEXT = `
Epic Seven Wallpaper Scraper
Scrapes and downloads official wallpapers and animated lobby videos from e7codex.com

USAGE:
  node src/index.js [options]
  npm start -- [options]

OPTIONS:
  -o, --output <dir>        Destination directory for wallpapers (default: ./wallpapers)
  -c, --category <name>     Filter by category: lobby, event, episode, story, animated, or all (default: all)
  -j, --concurrency <num>   Number of concurrent downloads (default: 6)
      --skip-animated       Do not download animated WebM wallpapers
      --force               Re-download files even if they already exist locally
      --dry-run             Display catalog items without downloading
  -h, --help                Show this help message

EXAMPLES:
  npm start
  node src/index.js --category lobby
  node src/index.js -o ./my-e7-wallpapers -j 10
  node src/index.js --dry-run
`;

async function main() {
  const options = {
    output: { type: 'string', short: 'o', default: './wallpapers' },
    category: { type: 'string', short: 'c', default: 'all' },
    concurrency: { type: 'string', short: 'j', default: '6' },
    'skip-animated': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false }
  };

  let parsed;
  try {
    parsed = parseArgs({ options, allowPositionals: false });
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m\n`);
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const { values } = parsed;

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  const outputDir = path.resolve(process.cwd(), values.output);
  const categoryFilter = values.category.toLowerCase().trim();
  const concurrency = Math.max(1, parseInt(values.concurrency, 10) || 6);
  const force = values.force;
  const dryRun = values['dry-run'];
  const skipAnimated = values['skip-animated'];

  console.log('\n\x1b[1m\x1b[36m=== Epic Seven Wallpaper Scraper ===\x1b[0m');
  console.log(`Source:      https://e7codex.com/#/wallpapers`);
  console.log(`Output:      ${outputDir}`);
  console.log(`Category:    ${categoryFilter}`);
  console.log(`Concurrency: ${concurrency}`);
  if (force) console.log(`Mode:        Force overwrite enabled`);
  if (dryRun) console.log(`Mode:        DRY RUN (no files will be written)`);
  console.log('-------------------------------------\n');

  console.log('Fetching catalog from e7codex...');
  const startTime = Date.now();
  const { items: allItems, categories } = await loadCatalog();

  if (allItems.length === 0) {
    console.error('\x1b[31mNo wallpapers found or failed to fetch manifest.\x1b[0m');
    process.exitCode = 1;
    return;
  }

  // Filter items
  let targetItems = allItems;
  if (skipAnimated) {
    targetItems = targetItems.filter(item => !item.isAnimated);
  }

  if (categoryFilter !== 'all') {
    targetItems = targetItems.filter(item => item.category === categoryFilter);
    if (targetItems.length === 0) {
      console.warn(`\x1b[33mNo items found for category '${categoryFilter}'. Available categories: ${categories.join(', ')}\x1b[0m`);
      return;
    }
  }

  // Category breakdown
  const categoryCounts = {};
  for (const item of targetItems) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  }

  console.log(`Found \x1b[32m${targetItems.length}\x1b[0m wallpapers across categories:`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  - ${cat}: ${count}`);
  }
  console.log('');

  if (dryRun) {
    console.log('\x1b[33m[DRY RUN] Preview of first 10 items:\x1b[0m');
    targetItems.slice(0, 10).forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.category}] ${item.title} -> ${item.filename}`);
    });
    if (targetItems.length > 10) {
      console.log(`  ... and ${targetItems.length - 10} more items.`);
    }
    console.log('\n\x1b[32mDry run completed successfully.\x1b[0m\n');
    return;
  }

  console.log(`Starting download to ${outputDir}...\n`);

  let lastLineLength = 0;
  const onProgress = (p) => {
    const symbol = p.status === 'downloaded' ? '\x1b[32m✓\x1b[0m' : p.status === 'skipped' ? '\x1b[34m-\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const statusText = `[${p.completed}/${p.total}] (${p.percent}%) ${symbol} [${p.item.category}] ${p.item.filename}`;
    const statsText = ` | DL: ${p.downloadedCount} | Skip: ${p.skippedCount} | Fail: ${p.failedCount}`;
    
    // Clear and print single-line or step updates
    const message = `${statusText}${statsText}`;
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${message.padEnd(lastLineLength, ' ')}`);
      lastLineLength = message.length;
    } else {
      if (p.completed % 25 === 0 || p.completed === p.total) {
        console.log(message);
      }
    }
  };

  const result = await downloadCatalog(targetItems, outputDir, {
    concurrency,
    force,
    savePoster: true
  }, onProgress);

  if (process.stdout.isTTY) {
    console.log('\n');
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\x1b[1m\x1b[32m=== Download Summary ===\x1b[0m');
  console.log(`Total Processed: ${result.total}`);
  console.log(`Downloaded:      \x1b[32m${result.downloadedCount}\x1b[0m (${formatBytes(result.totalBytes)})`);
  console.log(`Skipped (exist): \x1b[34m${result.skippedCount}\x1b[0m`);
  console.log(`Failed:          ${result.failedCount > 0 ? `\x1b[31m${result.failedCount}\x1b[0m` : '0'}`);
  console.log(`Time Elapsed:    ${durationSeconds}s`);
  console.log(`Metadata saved:  ${result.metadataPath}\n`);
}

main().catch(err => {
  console.error('\n\x1b[31mFatal error:\x1b[0m', err);
  process.exitCode = 1;
});
