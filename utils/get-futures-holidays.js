/**
 * Calculate US Futures Market (CME Group) holidays for a given year.
 * Holidays observed: if fixed-date holiday falls on Saturday → Friday,
 * if falls on Sunday → Monday.
 */

/**
 * Get Easter Sunday date for a given year (Anonymous Gregorian algorithm).
 * @param {number} year
 * @returns {Date}
 */
const getEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

/**
 * Apply Saturday→Friday / Sunday→Monday observation rule.
 * @param {Date} date
 * @returns {Date}
 */
const observe = (date) => {
  const dow = date.getDay();
  if (dow === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  if (dow === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return date;
};

/**
 * Get the Nth occurrence of a weekday in a given month.
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number} weekday - 0=Sun, 1=Mon, ..., 6=Sat
 * @param {number} n - 1-based occurrence (negative = from end, e.g. -1 = last)
 * @returns {Date}
 */
const nthWeekday = (year, month, weekday, n) => {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const diff = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }
  // negative n: count from end of month
  const last = new Date(year, month + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff + (n + 1) * 7);
};

/**
 * Format a Date as YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
const fmt = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const WEEKDAY_NAMES_ZH = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * Get US Futures Market (CME Group) holidays for a given year.
 * @param {number} year
 * @returns {{ date: string, weekday: string, name: string }[]}
 */
const getFuturesHolidays = (year) => {
  const easter = getEaster(year);
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);

  const holidays = [
    { name: "元旦 (New Year's Day)", date: observe(new Date(year, 0, 1)) },
    { name: '馬丁·路德·金紀念日 (MLK Day)', date: nthWeekday(year, 0, 1, 3) },
    { name: "總統日 (Presidents' Day)", date: nthWeekday(year, 1, 1, 3) },
    { name: '耶穌受難日 (Good Friday)', date: goodFriday },
    { name: '陣亡將士紀念日 (Memorial Day)', date: nthWeekday(year, 4, 1, -1) },
    ...(year >= 2022 ? [{ name: '六月節 (Juneteenth)', date: observe(new Date(year, 5, 19)) }] : []),
    { name: '獨立紀念日 (Independence Day)', date: observe(new Date(year, 6, 4)) },
    { name: '勞動節 (Labor Day)', date: nthWeekday(year, 8, 1, 1) },
    { name: '感恩節 (Thanksgiving Day)', date: nthWeekday(year, 10, 4, 4) },
    { name: '聖誕節 (Christmas Day)', date: observe(new Date(year, 11, 25)) },
  ];

  return holidays
    .sort((a, b) => a.date - b.date)
    .map(({ name, date }) => ({
      date: fmt(date),
      weekday: `週${WEEKDAY_NAMES_ZH[date.getDay()]}`,
      name,
    }));
};

export default getFuturesHolidays;
