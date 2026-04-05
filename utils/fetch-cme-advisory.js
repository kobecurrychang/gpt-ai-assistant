/**
 * CME holiday advisory data fetcher with JSON cache.
 *
 * Flow (mirrors the user's Python pattern):
 *   1. Load from local JSON cache  → return if fresh (< 7 days old)
 *   2. Try live fetch from CME     → HEAD-check advisory PDFs + detect SPA
 *   3. Save to cache if fetch OK
 *   4. Fall back to stale cache if fetch fails
 *   5. Return null if nothing available (caller uses hardcoded static data)
 *
 * Cache file: storage/cme-holidays-cache.json
 * Advisory PDFs: https://www.cmegroup.com/tools-information/holiday-calendar/files/{year}/
 */

import axios from 'axios';
import { cacheInfo, loadCache, saveCache } from './cme-holiday-cache.js';

const CME_BASE     = 'https://www.cmegroup.com';
const CME_TH_URL   = `${CME_BASE}/trading-hours.html`;
export const CME_ADV_BASE = `${CME_BASE}/tools-information/holiday-calendar/files`;

/**
 * Advisory PDF slug candidates per holiday ('{y}' replaced with the year).
 * Multiple slugs are tried in order; first reachable URL wins.
 */
const ADVISORY_SLUGS = [
  { key: "New Year's Day",   slugs: ['{y}-new-years-clearing-advisory', '{y}-new-years-day-clearing-advisory'] },
  { key: 'MLK Day',          slugs: ['{y}-mlk-clearing-advisory', '{y}-mlk-day-clearing-advisory', '{y}-martin-luther-king-clearing-advisory'] },
  { key: "Presidents' Day",  slugs: ['{y}-presidents-day-clearing-advisory'] },
  { key: 'Good Friday',      slugs: ['{y}-good-friday-clearing-advisory'] },
  { key: 'Memorial Day',     slugs: ['{y}-memorial-day-clearing-advisory'] },
  { key: 'Juneteenth',       slugs: ['{y}-juneteenth-clearing-advisory'] },
  { key: 'Independence Day', slugs: ['{y}-independence-day-clearing-advisory', '{y}-july-fourth-clearing-advisory'] },
  { key: 'Labor Day',        slugs: ['{y}-labor-day-clearing-advisory'] },
  { key: 'Thanksgiving Day', slugs: ['{y}-thanksgiving-clearing-advisory', '{y}-thanksgiving-day-clearing-advisory'] },
  { key: 'Christmas Day',    slugs: ['{y}-christmas-clearing-advisory', '{y}-christmas-day-clearing-advisory'] },
];

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const candidateUrls = (year, slugs) => {
  const urls = [];
  for (const slug of slugs) {
    const name = slug.replace(/\{y\}/g, year);
    urls.push(`${CME_ADV_BASE}/${year}/${name}.pdf`);
    urls.push(`${CME_ADV_BASE}/${year - 1}/${name}.pdf`);
  }
  return urls;
};

const headCheck = async (url) => {
  try {
    const res = await axios.head(url, { timeout: 5000, maxRedirects: 3 });
    return res.status >= 200 && res.status < 300 ? url : null;
  } catch {
    return null;
  }
};

const firstAvailable = async (urls) => {
  for (const url of urls) {
    const found = await headCheck(url);
    if (found) return found;
  }
  return null;
};

/**
 * Try to fetch CME trading-hours page and detect if it is a JavaScript SPA.
 * @returns {Promise<{ isSPA: boolean } | null>}
 */
const probeTradingHoursPage = async () => {
  try {
    const { data: html } = await axios.get(CME_TH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; futures-holiday-bot/1.0)',
        Accept: 'text/html',
      },
      timeout: 12000,
    });
    // If the static HTML contains a trading-hours data table, it's not an SPA.
    const hasTradingData = /<tr[^>]*>[\s\S]*?(equity|energy|metal|globex)/i.test(html);
    return { isSPA: !hasTradingData };
  } catch {
    return null;
  }
};

/* ─── Main export ───────────────────────────────────────────────────────── */

/**
 * @typedef {{
 *   advisoryLinks : { name: string, url: string }[],
 *   source        : 'cache' | 'live' | 'stale-cache' | 'none',
 *   fetchedAt     : string | null,
 *   isSPA         : boolean,
 *   pageReachable : boolean,
 *   cacheFile     : string,
 * }} AdvisoryResult
 *
 * @param {number}  year
 * @param {boolean} [forceRefresh=false] – bypass cache and fetch live
 * @returns {Promise<AdvisoryResult>}
 */
const fetchCmeAdvisory = async (year, forceRefresh = false) => {
  // ── 1. Try cache first (unless force refresh) ──────────────────────────
  if (!forceRefresh) {
    const cached = loadCache(year);
    if (cached) {
      return {
        advisoryLinks: cached.advisoryLinks,
        source:        'cache',
        fetchedAt:     cached.fetchedAt,
        isSPA:         true,
        pageReachable: true,
        cacheFile:     (await import('./cme-holiday-cache.js')).CACHE_FILE,
      };
    }
  }

  // ── 2. Live fetch: probe CME page + HEAD-check advisory PDFs ───────────
  const [pageResult, linkResults] = await Promise.all([
    probeTradingHoursPage(),
    Promise.all(
      ADVISORY_SLUGS.map(async ({ key, slugs }) => {
        const urls = candidateUrls(year, slugs);
        const url  = await firstAvailable(urls);
        return url ? { name: key, url } : null;
      }),
    ),
  ]);

  const pageReachable  = pageResult !== null;
  const isSPA          = pageResult?.isSPA ?? true;
  const advisoryLinks  = linkResults.filter(Boolean);

  // ── 3. Save to cache if we got anything useful ─────────────────────────
  let savedOk   = false;
  let fetchedAt = null;
  if (pageReachable) {
    savedOk = saveCache(year, { advisoryLinks });
    if (savedOk) {
      const info = (await import('./cme-holiday-cache.js')).cacheInfo(year);
      fetchedAt = info.fetchedAt ?? new Date().toISOString();
    }
  }

  // ── 4. If live fetch failed, try stale cache as last resort ───────────
  if (!pageReachable) {
    const stale = loadCache(year, /* allowStale */ true);
    if (stale) {
      return {
        advisoryLinks: stale.advisoryLinks,
        source:        'stale-cache',
        fetchedAt:     stale.fetchedAt,
        isSPA:         true,
        pageReachable: false,
        cacheFile:     (await import('./cme-holiday-cache.js')).CACHE_FILE,
      };
    }
  }

  return {
    advisoryLinks,
    source:        pageReachable ? 'live' : 'none',
    fetchedAt:     fetchedAt ?? (pageReachable ? new Date().toISOString() : null),
    isSPA,
    pageReachable,
    cacheFile:     (await import('./cme-holiday-cache.js')).CACHE_FILE,
  };
};

export default fetchCmeAdvisory;
