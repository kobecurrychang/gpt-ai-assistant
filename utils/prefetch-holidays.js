/**
 * 隔年 CME 假日資料預抓邏輯（無 cron，事件驅動）
 *
 * 觸發條件：本週（週日~週六）跨越到隔年時（即含有元旦的那一週）
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
 * 本週（週日~週六）的週六是否落在隔年？
 * 例：2026-12-27（週日）到 2027-01-01（週六）→ 週六年份 > 今日年份 → true
 */
const isCurrentWeekCrossYear = () => {
  const today = new Date();
  const sat   = new Date(today);
  sat.setDate(today.getDate() + (6 - today.getDay())); // 本週六
  return sat.getFullYear() > today.getFullYear();
};

/**
 * 每次 webhook 請求呼叫一次。
 * 條件不符或快取已存在時立即 return，幾乎零開銷。
 */
const maybePrefetchNextYear = () => {
  if (!isCurrentWeekCrossYear()) return;

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
