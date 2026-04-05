/**
 * US Futures settlement / last-trading-day calculator.
 *
 * Products covered:
 *   Index  – ES / NQ / YM  : quarterly, 3rd Friday of Mar/Jun/Sep/Dec
 *   CL     – WTI Crude Oil  : monthly, 3rd biz day before the 25th of the prior month
 *   NG     – Natural Gas    : monthly, 3rd biz day before the 1st of the delivery month
 *   GC     – Gold           : Feb/Apr/Jun/Aug/Oct/Dec, 3rd-to-last biz day of delivery month
 *   SI     – Silver         : Mar/May/Jul/Sep/Dec,     3rd-to-last biz day of delivery month
 *
 * All rules from CME/NYMEX/COMEX contract specifications.
 * Taiwan time = UTC+8, no DST.
 */

import getFuturesHolidays from './get-futures-holidays.js';

/* ─── Date helpers ──────────────────────────────────────────────────────── */

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const wdZH  = (d) => `週${WD_ZH[d.getDay()]}`;

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

/** Build a Set of holiday date strings for one or more years. */
const makeHolidaySet = (...years) => {
  const set = new Set();
  for (const year of years) {
    for (const h of getFuturesHolidays(year)) set.add(h.dateStr);
  }
  return set;
};

const isBizDay = (d, hSet) => !isWeekend(d) && !hSet.has(fmt(d));

/**
 * n-th business day strictly BEFORE anchor, counting backwards.
 * e.g. nBizDaysBefore(Jan25, 3) → 3rd biz day before Jan 25
 */
const nBizDaysBefore = (anchor, n, hSet) => {
  let d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 1);
  let count = 0;
  while (count < n) {
    if (isBizDay(d, hSet)) count++;
    if (count < n) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return d;
};

/**
 * n-th business day from the END of the month.
 * n=1 → last biz day, n=3 → 3rd-to-last biz day.
 */
const nthToLastBizDay = (year, month, n, hSet) => {
  let d = new Date(year, month + 1, 0); // last calendar day of month
  let count = 0;
  while (true) {
    if (isBizDay(d, hSet)) {
      count++;
      if (count === n) return d;
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
};

const nthWeekday = (year, month, weekday, n) => {
  const first = new Date(year, month, 1);
  const diff  = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
};

/* ─── Per-product rules ─────────────────────────────────────────────────── */

/**
 * CL (WTI Crude Oil) last trading day for a given delivery month.
 *
 * Rule: 3rd biz day before the 25th of the month PRECEDING delivery.
 * If the 25th is not a biz day, use the last biz day before the 25th as anchor.
 */
const clLastTrade = (deliveryYear, deliveryMonth, hSet) => {
  const pm    = deliveryMonth === 0 ? 11 : deliveryMonth - 1;
  const py    = deliveryMonth === 0 ? deliveryYear - 1 : deliveryYear;
  const the25 = new Date(py, pm, 25);
  const anchor = isBizDay(the25, hSet) ? the25 : nBizDaysBefore(the25, 1, hSet);
  return nBizDaysBefore(anchor, 3, hSet);
};

/**
 * NG (Natural Gas) last trading day for a given delivery month.
 *
 * Rule: 3rd biz day before the 1st calendar day of the delivery month.
 */
const ngLastTrade = (deliveryYear, deliveryMonth, hSet) => {
  const the1st = new Date(deliveryYear, deliveryMonth, 1);
  return nBizDaysBefore(the1st, 3, hSet);
};

/**
 * GC / SI last trading day: 3rd-to-last biz day of the delivery month.
 */
const metalLastTrade = (year, month, hSet) => nthToLastBizDay(year, month, 3, hSet);

/* ─── Main export ───────────────────────────────────────────────────────── */

const MONTHS_ZH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/**
 * Returns settlement/last-trading-day info for all major CME products for `year`.
 *
 * @param {number} year
 * @returns {{
 *   index : { quarter: string, dateStr: string, weekday: string }[],
 *   cl    : { month: string, dateStr: string, weekday: string }[],
 *   ng    : { month: string, dateStr: string, weekday: string }[],
 *   gc    : { month: string, dateStr: string, weekday: string }[],
 *   si    : { month: string, dateStr: string, weekday: string }[],
 * }}
 */
const getFuturesSettlements = (year) => {
  // Holiday sets: need year-1 for Jan delivery (CL/NG last trade falls in year-1)
  const hSet = makeHolidaySet(year - 1, year);

  /* Index – 3rd Friday of Mar/Jun/Sep/Dec */
  const INDEX_MONTHS = [2, 5, 8, 11]; // 0-based
  const QUARTERS     = ['Q1', 'Q2', 'Q3', 'Q4'];
  const index = INDEX_MONTHS.map((m, i) => {
    const d = nthWeekday(year, m, 5, 3); // 3rd Friday
    return { quarter: QUARTERS[i], dateStr: fmt(d), weekday: wdZH(d) };
  });

  /* CL – all 12 delivery months */
  const cl = Array.from({ length: 12 }, (_, m) => {
    const d = clLastTrade(year, m, hSet);
    return { month: `${MONTHS_ZH[m]}月合約`, dateStr: fmt(d), weekday: wdZH(d) };
  });

  /* NG – all 12 delivery months */
  const ng = Array.from({ length: 12 }, (_, m) => {
    const d = ngLastTrade(year, m, hSet);
    return { month: `${MONTHS_ZH[m]}月合約`, dateStr: fmt(d), weekday: wdZH(d) };
  });

  /* GC – Feb/Apr/Jun/Aug/Oct/Dec (even months, 0-based: 1,3,5,7,9,11) */
  const GC_MONTHS = [1, 3, 5, 7, 9, 11];
  const gc = GC_MONTHS.map((m) => {
    const d = metalLastTrade(year, m, hSet);
    return { month: `${MONTHS_ZH[m]}月合約`, dateStr: fmt(d), weekday: wdZH(d) };
  });

  /* SI – Mar/May/Jul/Sep/Dec (0-based: 2,4,6,8,11) */
  const SI_MONTHS = [2, 4, 6, 8, 11];
  const si = SI_MONTHS.map((m) => {
    const d = metalLastTrade(year, m, hSet);
    return { month: `${MONTHS_ZH[m]}月合約`, dateStr: fmt(d), weekday: wdZH(d) };
  });

  return { index, cl, ng, gc, si };
};

export default getFuturesSettlements;
