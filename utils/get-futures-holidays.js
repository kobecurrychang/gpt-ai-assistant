/**
 * US Futures Market (CME / NYMEX / COMEX) holiday schedule calculator.
 *
 * Product groups:
 *   index  → E-mini S&P 500 (ES), Nasdaq 100 (NQ), Dow Jones (YM)  — CME
 *   energy → WTI Crude Oil (CL), Natural Gas (NG)                  — NYMEX
 *   metals → Gold (GC), Silver (SI)                                 — COMEX
 *
 * Data source: CME Group official holiday advisory PDFs.
 * Close times are in CT (Central Time). Taiwan = UTC+8 (no DST).
 * CDT = UTC-5 (2nd Sun Mar → 1st Sun Nov), CST = UTC-6 (otherwise).
 *
 * ⚠ CME finalises exact minute-precision close times ~2 weeks before each
 *   holiday. Always verify at https://www.cmegroup.com/trading-hours.html
 *   before trading around holidays.
 *
 * Per-product holiday types
 * ──────────────────────────────────────────────────────────────────────────
 * 'full'           → no electronic trading at all
 * 'HH:MM'          → early close at that CT time
 * 'special_HH:MM'  → special abbreviated session ending at that CT time
 *                    (used for Good Friday when NFP falls on that day)
 */

/* ─── Date helpers ─────────────────────────────────────────────────────────── */

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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const observe = (date) => {
  const dow = date.getDay();
  if (dow === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  if (dow === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return date;
};

const nthWeekday = (year, month, weekday, n) => {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const diff = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff + (n + 1) * 7);
};

const fmt = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const wdZH = (date) => `週${WD_ZH[date.getDay()]}`;

/* ─── Timezone: CT → Taiwan (UTC+8) ────────────────────────────────────────── */

// US DST: 2nd Sunday in March → 1st Sunday in November
const isCDT = (date) => {
  const y = date.getFullYear();
  const start = nthWeekday(y, 2, 0, 2);  // 2nd Sun Mar
  const end   = nthWeekday(y, 10, 0, 1); // 1st Sun Nov
  return date >= start && date < end;
};

/**
 * Convert a CT clock-time on a US date to Taiwan time.
 * @param {Date}   usDate
 * @param {string} ctStr  – "HH:MM" in CT
 * @returns {{ twTime: string, twDateStr: string, twDate: Date, zone: string, offset: number }}
 */
const ctToTW = (usDate, ctStr) => {
  const [ctH, ctM] = ctStr.split(':').map(Number);
  const summer = isCDT(usDate);
  const ctOffsetNeg = summer ? 5 : 6;   // |CT offset from UTC|
  const offset = summer ? 13 : 14;      // CT → Taiwan hours to add

  const ctMin = ctH * 60 + ctM;
  const utcMin = ctMin + ctOffsetNeg * 60;
  const twMin  = utcMin + 8 * 60;

  const dayOff = Math.floor(twMin / 1440);
  const rem    = twMin % 1440;
  const twH    = Math.floor(rem / 60);
  const twMi   = rem % 60;

  const twDate = new Date(usDate.getFullYear(), usDate.getMonth(), usDate.getDate() + dayOff);
  return {
    twTime:    `${String(twH).padStart(2, '0')}:${String(twMi).padStart(2, '0')}`,
    twDateStr: fmt(twDate),
    twDate,
    zone:   summer ? 'CDT' : 'CST',
    offset, // hours added CT→TW
  };
};

/* ─── Per-product close-time templates ─────────────────────────────────────── */
// 'full' = no trading. Time strings are CT "HH:MM".
// Based on CME 2026 advisory; pattern is consistent across years.
// ⚠ CME may adjust by a few minutes; always verify the official advisory.

const SCHEDULES = {
  fullAll:    { index: 'full',  energy: 'full',  metals: 'full'  },
  // Most US equity-linked holidays
  standard:   { index: '12:15', energy: '12:30', metals: '12:30' },
  // Memorial Day / Labor Day – energy/metals slightly later
  memorial:   { index: '12:00', energy: '13:30', metals: '13:30' },
  // Good Friday (normal year): all full close
  goodFriAll: { index: 'full',  energy: 'full',  metals: 'full'  },
  // Good Friday (NFP on Good Friday, e.g. 2026): index abbreviated; others closed
  goodFriNFP: { index: '08:15', energy: 'full',  metals: 'full'  },
};

/* ─── Main export ───────────────────────────────────────────────────────────── */

/**
 * @param {Date}   date      - US holiday date
 * @param {string} name      - Holiday name
 * @param {object} schedule  - { index, energy, metals } – 'full' or 'HH:MM' in CT
 * @returns {object}         - Enriched holiday entry with Taiwan times
 */
const buildEntry = (date, name, schedule) => {
  const resolve = (ct) => {
    if (ct === 'full') return { close: 'full' };
    const tw = ctToTW(date, ct);
    return {
      close:     ct,
      ctZone:    tw.zone,
      twTime:    tw.twTime,
      twDateStr: tw.twDateStr,
      twWeekday: wdZH(tw.twDate),
      offset:    tw.offset,
    };
  };
  return {
    dateStr:  fmt(date),
    weekday:  wdZH(date),
    name,
    index:    resolve(schedule.index),
    energy:   resolve(schedule.energy),
    metals:   resolve(schedule.metals),
  };
};

/**
 * Returns an array of holiday entries for the given year,
 * each with per-product close info and Taiwan times.
 *
 * @param {number} year
 * @returns {Array<{dateStr, weekday, name, index, energy, metals}>}
 */
const getFuturesHolidays = (year) => {
  const easter        = getEaster(year);
  const goodFriday    = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);

  // Is NFP (Employment Situation) released on Good Friday?
  // NFP = first Friday of each month. Check if GF === first Friday of its month.
  const nfpOnGF = fmt(nthWeekday(goodFriday.getFullYear(), goodFriday.getMonth(), 5, 1)) === fmt(goodFriday);

  const mlkDay        = nthWeekday(year, 0,  1, 3);
  const presidentsDay = nthWeekday(year, 1,  1, 3);
  const memorialDay   = nthWeekday(year, 4,  1, -1);
  const juneteenth    = year >= 2022 ? observe(new Date(year, 5, 19)) : null;
  const independenceDay = observe(new Date(year, 6, 4));
  const laborDay      = nthWeekday(year, 8,  1, 1);
  const thanksgiving  = nthWeekday(year, 10, 4, 4);
  const blackFriday   = new Date(thanksgiving.getFullYear(), thanksgiving.getMonth(), thanksgiving.getDate() + 1);
  const christmasDay  = observe(new Date(year, 11, 25));
  const newYearsDay   = observe(new Date(year, 0, 1));

  const holidays = [
    buildEntry(newYearsDay,      "元旦 (New Year's Day)",                          SCHEDULES.fullAll),
    buildEntry(mlkDay,           '馬丁路德金紀念日 (MLK Day)',                       SCHEDULES.standard),
    buildEntry(presidentsDay,    "總統日 (Presidents' Day)",                        SCHEDULES.standard),
    buildEntry(goodFriday,       '耶穌受難日 (Good Friday)',                        nfpOnGF ? SCHEDULES.goodFriNFP : SCHEDULES.goodFriAll),
    buildEntry(memorialDay,      '陣亡將士紀念日 (Memorial Day)',                    SCHEDULES.memorial),
    ...(juneteenth ? [buildEntry(juneteenth, '六月節國家獨立紀念日 (Juneteenth)', SCHEDULES.standard)] : []),
    buildEntry(independenceDay,  '獨立紀念日 (Independence Day)',                   SCHEDULES.standard),
    buildEntry(laborDay,         '勞動節 (Labor Day)',                              SCHEDULES.memorial),
    buildEntry(thanksgiving,     '感恩節 (Thanksgiving Day)',                       SCHEDULES.fullAll),
    buildEntry(blackFriday,      '感恩節翌日 (Black Friday)',                       SCHEDULES.standard),
    buildEntry(christmasDay,     '聖誕節 (Christmas Day)',                          SCHEDULES.fullAll),
  ];

  return holidays.sort((a, b) => (a.dateStr < b.dateStr ? -1 : 1));
};

export default getFuturesHolidays;
