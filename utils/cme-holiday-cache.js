/**
 * Local JSON cache for computed CME holiday schedule.
 *
 * Cache file: <project-root>/storage/cme-holidays-cache.json
 *
 * Schema:
 * {
 *   "2026": {
 *     "cachedAt"  : "2026-04-05T07:00:00.000Z",
 *     "dst"       : { "start": "2026-03-08", "startWd": "週日",
 *                     "end":   "2026-11-01", "endWd":   "週日" },
 *     "holidays"  : [ { dateStr, weekday, name, index, energy, metals }, ... ]
 *   }
 * }
 *
 * The data is deterministic (pure date math), so it never goes stale.
 * ⚠ On serverless (e.g. Vercel), writes silently fail; the cache won't persist
 *   across deployments, but the app still works correctly via recomputation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = join(__dirname, '..', 'storage');
const CACHE_FILE = join(CACHE_DIR, 'cme-holidays-cache.json');

/* ─── File helpers ──────────────────────────────────────────────────────── */

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
    return false; // read-only filesystem (serverless) – silent fail
  }
};

/* ─── Public API ────────────────────────────────────────────────────────── */

/**
 * Load cached holiday schedule for a year.
 * Returns null if not cached yet.
 *
 * @param {number} year
 * @returns {{ cachedAt: string, dst: object, holidays: Array } | null}
 */
const loadCache = (year) => {
  const entry = readRaw()[String(year)];
  return entry ?? null;
};

/**
 * Save computed holiday schedule for a year.
 *
 * @param {number} year
 * @param {{ dst: object, holidays: Array }} data
 * @returns {boolean} true if written to disk
 */
const saveCache = (year, data) => {
  const all = readRaw();
  all[String(year)] = {
    cachedAt: new Date().toISOString(),
    dst:      data.dst,
    holidays: data.holidays,
  };
  return writeRaw(all);
};

export { loadCache, saveCache, CACHE_FILE };
