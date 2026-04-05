/**
 * 隔年 CME 假日資料預抓邏輯（無 cron，事件驅動）
 *
 * 觸發條件：每年 10/31、11/1、11/2（CME Q4 公告期，三天互為 retry）
 * 每次 webhook 請求都會做一次 O(1) 日期判斷，命中才計算+快取。
 * 快取已存在時直接跳過，不重複計算。
 */

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

/**
 * 今天是否為每年的 10/31、11/1 或 11/2？
 */
const isTriggerDate = () => {
  const today = new Date();
  const m = today.getMonth() + 1; // 1-based
  const d = today.getDate();
  return (m === 10 && d === 31) || (m === 11 && (d === 1 || d === 2));
};

/**
 * 每次 webhook 請求呼叫一次。
 * 條件不符或快取已存在時立即 return，幾乎零開銷。
 */
const maybePrefetchNextYear = () => {
  if (!isTriggerDate()) return;

  const nextYear = new Date().getFullYear() + 1;
  if (loadCache(nextYear)) return; // 已快取，跳過

  try {
    const holidays = getFuturesHolidays(nextYear);
    const dst      = getDSTDates(nextYear);
    saveCache(nextYear, { dst, holidays });
    console.log(`[CME Cache] ${nextYear} 假日資料預抓完成，已寫入快取。`);
  } catch (err) {
    console.error(`[CME Cache] ${nextYear} 預抓失敗：`, err.message);
  }
};

export { maybePrefetchNextYear };
