import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/**
 * Format bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Download a single file using streaming and atomic renaming
 * @param {string} url
 * @param {string} destinationPath
 * @param {object} options
 * @returns {Promise<{ status: 'downloaded' | 'skipped' | 'failed', bytes: number, error?: string }>}
 */
async function downloadFile(url, destinationPath, { force = false, maxRetries = 3 } = {}) {
  // Ensure target folder exists
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });

  // Check if file already exists
  if (!force) {
    try {
      const stat = await fsp.stat(destinationPath);
      if (stat.size > 0) {
        return { status: 'skipped', bytes: stat.size };
      }
    } catch {
      // File does not exist, proceed
    }
  }

  const tempPath = `${destinationPath}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EpicSevenWallpaperScraper/1.0',
          'Referer': 'https://e7codex.com/'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const fileStream = fs.createWriteStream(tempPath);
      // Convert web ReadableStream to node Readable
      const nodeReadable = Readable.fromWeb(response.body);

      await pipeline(nodeReadable, fileStream);

      // Verify file was written and is not empty
      const tempStat = await fsp.stat(tempPath);
      if (tempStat.size === 0) {
        throw new Error('Downloaded file has 0 bytes');
      }

      // Atomic rename to final path
      await fsp.rename(tempPath, destinationPath);

      return { status: 'downloaded', bytes: tempStat.size };
    } catch (err) {
      // Clean up temporary file
      try {
        await fsp.unlink(tempPath);
      } catch {
        // Ignore unlink error
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise(res => setTimeout(res, delay));
      } else {
        return { status: 'failed', bytes: 0, error: err.message };
      }
    }
  }

  return { status: 'failed', bytes: 0, error: 'Exceeded max retries' };
}

/**
 * Execute concurrent downloads with progress reporting
 * @param {Array<object>} items
 * @param {string} outputDir
 * @param {object} options
 * @param {function} onProgress
 * @returns {Promise<object>}
 */
export async function downloadCatalog(items, outputDir, options = {}, onProgress = () => {}) {
  const {
    concurrency = 6,
    force = false,
    savePoster = true
  } = options;

  await fsp.mkdir(outputDir, { recursive: true });

  const total = items.length;
  let completed = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let totalBytes = 0;

  const results = [];
  let itemIndex = 0;

  async function worker() {
    while (itemIndex < items.length) {
      const currentIndex = itemIndex++;
      const item = items[currentIndex];

      const itemDir = path.join(outputDir, item.category);
      const filePath = path.join(itemDir, item.filename);

      const res = await downloadFile(item.url, filePath, { force });

      // If item is animated and has a poster preview, download it too
      if (res.status !== 'failed' && item.isAnimated && item.posterUrl && savePoster) {
        const posterFilename = item.filename.replace(/\.[^/.]+$/, '.jpg');
        const posterPath = path.join(itemDir, posterFilename);
        await downloadFile(item.posterUrl, posterPath, { force }).catch(() => {});
      }

      completed++;
      if (res.status === 'downloaded') {
        downloadedCount++;
        totalBytes += res.bytes;
      } else if (res.status === 'skipped') {
        skippedCount++;
      } else {
        failedCount++;
      }

      results.push({
        item,
        status: res.status,
        bytes: res.bytes,
        error: res.error,
        localPath: path.relative(process.cwd(), filePath)
      });

      onProgress({
        total,
        completed,
        percent: Math.floor((completed / total) * 100),
        item,
        status: res.status,
        bytes: res.bytes,
        downloadedCount,
        skippedCount,
        failedCount,
        error: res.error
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  // Write metadata.json in the output directory
  const metadataPath = path.join(outputDir, 'metadata.json');
  const metadata = {
    generatedAt: new Date().toISOString(),
    source: 'https://e7codex.com/#/wallpapers',
    totalItems: total,
    summary: {
      downloaded: downloadedCount,
      skipped: skippedCount,
      failed: failedCount,
      totalBytes
    },
    items: results.map(r => ({
      id: r.item.id,
      title: r.item.title,
      category: r.item.category,
      isAnimated: r.item.isAnimated,
      filename: r.item.filename,
      localPath: r.localPath,
      sourceUrl: r.item.url,
      characters: r.item.characters,
      meta: r.item.meta,
      status: r.status
    }))
  };

  await fsp.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  return {
    total,
    downloadedCount,
    skippedCount,
    failedCount,
    totalBytes,
    metadataPath
  };
}
