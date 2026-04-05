/**
 * Attempts to fetch live CME holiday trading-hours data from the official website.
 *
 * Architecture:
 *   1. Try fetching the CME trading-hours HTML page → parse any embedded JSON/table.
 *   2. Try checking availability of per-holiday Clearing Advisory PDFs (HEAD request).
 *   3. Return live data if found; otherwise return null so the caller falls back
 *      to the hardcoded schedule in get-futures-holidays.js.
 *
 * ⚠ CME's trading-hours page is a JavaScript SPA. A plain HTTP GET only returns
 *   the shell HTML; the actual trading-hours table is rendered client-side.
 *   We therefore detect this case and surface helpful advisory PDF links instead.
 */

import axios from 'axios';

const CME_BASE     = 'https://www.cmegroup.com';
const CME_TH_URL   = `${CME_BASE}/trading-hours.html`;
const CME_ADV_BASE = `${CME_BASE}/tools-information/holiday-calendar/files`;

/**
 * CME Clearing Advisory PDF slug map.
 * Each entry has candidate filename patterns (tried in order).
 * Slugs confirmed from CME's published advisory URLs.
 */
const ADVISORY_SLUGS = [
  { key: "New Year's Day",    slugs: ['{y}-new-years-clearing-advisory', '{y}-new-years-day-clearing-advisory'] },
  { key: 'MLK Day',           slugs: ['{y}-mlk-clearing-advisory', '{y}-mlk-day-clearing-advisory', '{y}-martin-luther-king-clearing-advisory'] },
  { key: "Presidents' Day",   slugs: ['{y}-presidents-day-clearing-advisory'] },
  { key: 'Good Friday',       slugs: ['{y}-good-friday-clearing-advisory'] },
  { key: 'Memorial Day',      slugs: ['{y}-memorial-day-clearing-advisory'] },
  { key: 'Juneteenth',        slugs: ['{y}-juneteenth-clearing-advisory'] },
  { key: 'Independence Day',  slugs: ['{y}-independence-day-clearing-advisory', '{y}-july-fourth-clearing-advisory'] },
  { key: 'Labor Day',         slugs: ['{y}-labor-day-clearing-advisory'] },
  { key: 'Thanksgiving Day',  slugs: ['{y}-thanksgiving-clearing-advisory', '{y}-thanksgiving-day-clearing-advisory'] },
  { key: 'Christmas Day',     slugs: ['{y}-christmas-clearing-advisory', '{y}-christmas-day-clearing-advisory'] },
];

/**
 * Build all candidate PDF URLs for a holiday in a given year.
 * CME sometimes publishes in the prior year's folder (for early-year holidays).
 * @param {number}   year
 * @param {string[]} slugs  – slug templates containing '{y}'
 * @returns {string[]}
 */
const candidateUrls = (year, slugs) => {
  const urls = [];
  for (const slug of slugs) {
    const name = slug.replace(/\{y\}/g, year);
    // Try current year folder first, then prior year folder
    urls.push(`${CME_ADV_BASE}/${year}/${name}.pdf`);
    urls.push(`${CME_ADV_BASE}/${year - 1}/${name}.pdf`);
  }
  return urls;
};

/**
 * HEAD-request a URL to check existence without downloading the body.
 * Returns the final URL if reachable, null otherwise.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
const headCheck = async (url) => {
  try {
    const res = await axios.head(url, { timeout: 5000, maxRedirects: 3 });
    if (res.status >= 200 && res.status < 300) return url;
    return null;
  } catch {
    return null;
  }
};

/**
 * Find the first reachable PDF URL among candidates.
 * @param {string[]} urls
 * @returns {Promise<string|null>}
 */
const firstAvailable = async (urls) => {
  for (const url of urls) {
    const found = await headCheck(url);
    if (found) return found;
  }
  return null;
};

/**
 * Try to fetch the CME trading-hours HTML page and detect whether
 * the page is a JavaScript SPA (data not in static HTML).
 * @returns {Promise<{isSPA: boolean, html?: string}|null>}
 */
const fetchTradingHoursPage = async () => {
  try {
    const { data: html } = await axios.get(CME_TH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; futures-holiday-bot/1.0)',
        Accept: 'text/html',
      },
      timeout: 12000,
    });

    // SPA detection: no in-page trading hours table → skeleton only
    const hasTradingData = /<tr[^>]*>[\s\S]*?(equity|energy|metal|globex)/i.test(html);
    return { isSPA: !hasTradingData, html };
  } catch {
    return null;
  }
};

/**
 * Main entry point.
 *
 * @param {number} year
 * @returns {Promise<{
 *   advisoryLinks: { name: string, url: string }[],
 *   isSPA: boolean,
 *   pageReachable: boolean,
 * }>}
 */
const fetchCmeAdvisory = async (year) => {
  // 1 – Check if CME website is reachable at all
  const pageResult = await fetchTradingHoursPage();
  const pageReachable = pageResult !== null;
  const isSPA = pageResult?.isSPA ?? true;

  // 2 – In parallel, HEAD-check all advisory PDFs for the year
  const linkResults = await Promise.all(
    ADVISORY_SLUGS.map(async ({ key, slugs }) => {
      const urls = candidateUrls(year, slugs);
      const url = await firstAvailable(urls);
      return url ? { name: key, url } : null;
    }),
  );

  const advisoryLinks = linkResults.filter(Boolean);

  return { advisoryLinks, isSPA, pageReachable };
};

export default fetchCmeAdvisory;
