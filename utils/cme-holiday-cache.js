/**
 * Local JSON cache for CME holiday advisory data.
 *
 * Cache file: <project-root>/storage/cme-holidays-cache.json
 *
 * Schema:
 * {
 *   "2026": {
 *     "fetchedAt": "2026-03-15T10:00:00.000Z",   // ISO timestamp
 *     "advisoryLinks": [
 *       { "name": "Good Friday", "url": "https://..." },
 *       ...
 *     ]
 *   }
 * }
 *
 * ⚠ On serverless platforms (e.g. Vercel), the filesystem is read-only
 *   after deployment. Writes will silently fail; reads of any pre-bundled
 *   cache file will still work.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = join(__dirname, '..', 'storage');
const CACHE_FILE = join(CACHE_DIR, 'cme-holidays-cache.json');

/** How many days before a cached entry is considered stale */
const CACHE_STALE_DAYS = 7;

/* ─── Internal helpers ──────────────────────────────────────────────────── */

const readRaw = () => {
  try {
    if (!existsSync(CACHE_FILE)) return {};
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
};

const writeRaw = (data) => {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    // Silently fail on read-only filesystems (serverless)
    return false;
  }
};

/* ─── Public API ────────────────────────────────────────────────────────── */

/**
 * Load cached advisory data for a year.
 * Returns null if no cache exists or cache is stale.
 *
 * @param {number}  year
 * @param {boolean} [allowStale=false] – if true, return stale data rather than null
 * @returns {{ fetchedAt: string, advisoryLinks: Array } | null}
 */
const loadCache = (year, allowStale = false) => {
  const all = readRaw();
  const entry = all[String(year)];
  if (!entry) return null;

  if (!allowStale) {
    const age = (Date.now() - new Date(entry.fetchedAt).getTime()) / 86400000;
    if (age > CACHE_STALE_DAYS) return null;
  }

  return entry;
};

/**
 * Save advisory data for a year to the cache.
 *
 * @param {number} year
 * @param {{ advisoryLinks: Array }} data
 * @returns {boolean} true if saved successfully
 */
const saveCache = (year, data) => {
  const all = readRaw();
  all[String(year)] = {
    fetchedAt: new Date().toISOString(),
    advisoryLinks: data.advisoryLinks,
  };
  const ok = writeRaw(all);
  return ok;
};

/**
 * Return cache metadata for display.
 * @param {number} year
 * @returns {{ exists: boolean, fetchedAt?: string, stale?: boolean }}
 */
const cacheInfo = (year) => {
  const all = readRaw();
  const entry = all[String(year)];
  if (!entry) return { exists: false };

  const age = (Date.now() - new Date(entry.fetchedAt).getTime()) / 86400000;
  return {
    exists:    true,
    fetchedAt: entry.fetchedAt,
    stale:     age > CACHE_STALE_DAYS,
    ageDays:   Math.floor(age),
  };
};

export { cacheInfo, loadCache, saveCache, CACHE_FILE };
