const BASE_URL = 'https://e7codex.com';
const CDN_URL = 'https://assets.e7codex.com';

/**
 * Fetch and parse a JSON endpoint from e7codex
 * @param {string} endpoint - Path relative to base URL
 * @returns {Promise<any>}
 */
async function fetchJson(endpoint) {
  const url = `${BASE_URL}/${endpoint.replace(/^\//, '')}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EpicSevenWallpaperScraper/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract filename from a path or URL
 * @param {string} pathStr
 * @returns {string}
 */
function getFilenameFromPath(pathStr) {
  const parts = pathStr.split('/');
  return parts[parts.length - 1];
}

/**
 * Load all wallpaper catalogs and build a unified item list
 * @returns {Promise<{ items: Array<object>, categories: string[] }>}
 */
export async function loadCatalog() {
  const [wallpapersRaw, lobbyAnimsRaw, wpCharsRaw] = await Promise.all([
    fetchJson('data/wallpapers.json').catch(err => {
      console.warn(`[WARN] Could not load static wallpapers: ${err.message}`);
      return [];
    }),
    fetchJson('data/lobby_anims.json').catch(err => {
      console.warn(`[WARN] Could not load lobby animations: ${err.message}`);
      return [];
    }),
    fetchJson('data/wallpaper_chars.json').catch(() => ({ links: {} }))
  ]);

  const charMap = new Map(Object.entries(wpCharsRaw.links || {}));
  const items = [];

  // 1. Process static wallpapers
  for (const wp of wallpapersRaw) {
    const filename = wp.file ? getFilenameFromPath(wp.file) : `${wp.stem || 'wallpaper'}.png`;
    const category = (wp.category || 'other').toLowerCase();
    const linkedChars = charMap.get(wp.stem) || [];

    items.push({
      id: wp.stem || filename.replace(/\.[^/.]+$/, ''),
      title: wp.name || wp.stem || filename,
      category,
      isAnimated: false,
      url: `${BASE_URL}/${wp.file.replace(/^\//, '')}`,
      filename,
      characters: linkedChars.map(c => ({ id: c.id, count: c.n || 1 })),
      meta: {
        stem: wp.stem,
        originalPath: wp.file
      }
    });
  }

  // 2. Process animated wallpapers (lobby anims)
  for (const anim of lobbyAnimsRaw) {
    if (!anim.video) continue;
    const filename = getFilenameFromPath(anim.video);

    items.push({
      id: anim.id || filename.replace(/\.[^/.]+$/, ''),
      title: anim.title || anim.id || filename,
      category: 'animated',
      isAnimated: true,
      url: `${CDN_URL}/${anim.video.replace(/^\//, '')}`,
      posterUrl: anim.poster ? `${BASE_URL}/${anim.poster.replace(/^\//, '')}` : null,
      filename,
      characters: (anim.units || []).map(u => ({ id: u })),
      meta: {
        id: anim.id,
        bytes: anim.bytes,
        durationSeconds: anim.duration_s,
        released: anim.released,
        note: anim.note
      }
    });
  }

  const categories = [...new Set(items.map(item => item.category))];

  return { items, categories };
}
