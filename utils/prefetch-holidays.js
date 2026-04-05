/**
 * Pre-fetch & cache the next year's CME holiday schedule.
 *
 * Triggered by a cron on Oct 1 / Nov 1 / Dec 1 each year.
 * If the cache already exists for that year, silently skips.
 * "一直到資訊完善" — the three monthly attempts act as automatic retries
 * in case the server was down or the filesystem was unavailable on prior runs.
 */

import { schedule } from 'node-cron';
import getFuturesHolidays from './get-futures-holidays.js';
import { loadCache, saveCache } from './cme-holiday-cache.js';

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const wdZH  = (d) => `週${WD_ZH[d.getDay()]}`;
const fmt   = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const nthWeekday = (year, month, weekday, n) => {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const diff  = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff + (n + 1) * 7);
};

const getDSTDates = (year) => {
  const start = nthWeekday(year, 2,  0, 2);
  const end   = nthWeekday(year, 10, 0, 1);
  return { start: fmt(start), startWd: wdZH(start), end: fmt(end), endWd: wdZH(end) };
};

const prefetchNextYear = () => {
  const nextYear = new Date().getFullYear() + 1;

  if (loadCache(nextYear)) {
    console.log(`[CME Cache] ${nextYear} 假日資料已存在，跳過預抓。`);
    return;
  }

  try {
    const holidays = getFuturesHolidays(nextYear);
    const dst      = getDSTDates(nextYear);
    saveCache(nextYear, { dst, holidays });
    console.log(`[CME Cache] ${nextYear} 假日資料預抓完成，已寫入快取。`);
  } catch (err) {
    console.error(`[CME Cache] ${nextYear} 預抓失敗：`, err.message);
  }
};

/**
 * Register cron jobs. Call once at app startup.
 * Runs at 02:00 (server local time) on Oct 1, Nov 1, Dec 1 each year.
 */
const registerPrefetchCron = () => {
  // "0 2 1 10,11,12 *" — 02:00 on the 1st of Oct / Nov / Dec
  schedule('0 2 1 10,11,12 *', prefetchNextYear, { timezone: 'Asia/Taipei' });
  console.log('[CME Cache] 預抓排程已啟動（10/1、11/1、12/1 02:00 台灣時間）。');
};

export { registerPrefetchCron, prefetchNextYear };
