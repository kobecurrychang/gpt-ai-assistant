/**
 * US Futures Market (CME Group) holiday & early-close schedule calculator.
 *
 * Product groups covered:
 *   Energy  → WTI Crude Oil (CL), Natural Gas (NG)  — NYMEX
 *   Index   → E-mini S&P 500 (ES), Nasdaq 100 (NQ), Dow Jones (YM) — CME
 *   Metals  → Gold (GC), Silver (SI) — COMEX
 *
 * All Taiwan times are UTC+8 (no DST).
 * CME uses Central Time: CDT = UTC-5 (mid-Mar → early Nov),
 *                        CST = UTC-6 (early Nov → mid-Mar).
 *
 * Rules applied:
 *  Full close (all products) : 9 federal holidays CME observes
 *  Full close (index+metals) : Good Friday (energy stays open on Good Friday)
 *  Early close (all products): Thanksgiving Eve, Independence Day Eve,
 *                               Christmas Eve, New Year's Eve  — at 13:00 CT
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

// If Saturday → Friday, if Sunday → Monday
const observe = (date) => {
  const dow = date.getDay();
  if (dow === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  if (dow === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return date;
};

// n-th weekday in month (n negative = from end, e.g. -1 = last)
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

const isBizDay = (date) => ![0, 6].includes(date.getDay());

// Last business day strictly before `date`
const prevBizDay = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  do { d.setDate(d.getDate() - 1); } while (!isBizDay(d));
  return d;
};

/* ─── Timezone conversion ───────────────────────────────────────────────────── */

// US DST: 2nd Sunday in March → 1st Sunday in November
const isCDT = (date) => {
  const y = date.getFullYear();
  const start = nthWeekday(y, 2, 0, 2); // 2nd Sun Mar
  const end   = nthWeekday(y, 10, 0, 1); // 1st Sun Nov
  return date >= start && date < end;
};

/**
 * Convert a CT clock time on a US date to Taiwan time (UTC+8).
 * @param {Date}   usDate   - The US calendar date
 * @param {number} ctHour   - Hour in CT (24-h)
 * @param {number} ctMin    - Minute in CT
 * @returns {{ time: string, dateStr: string, date: Date, zone: string }}
 */
const ctToTW = (usDate, ctHour, ctMin = 0) => {
  const summer = isCDT(usDate);
  // CT offset from UTC: CDT = -5, CST = -6
  const ctOffsetFromUTC = summer ? -5 : -6;
  const twOffsetFromUTC = 8;

  const ctMin24 = ctHour * 60 + ctMin;
  const utcMin  = ctMin24 - ctOffsetFromUTC * 60;   // subtract negative → add
  const twMin   = utcMin  + twOffsetFromUTC * 60;

  const dayOffset = Math.floor(twMin / 1440);
  const rem = twMin % 1440;
  const twH = Math.floor(rem / 60);
  const twM = rem % 60;

  const twDate = new Date(
    usDate.getFullYear(),
    usDate.getMonth(),
    usDate.getDate() + dayOffset,
  );

  return {
    time:    `${String(twH).padStart(2, '0')}:${String(twM).padStart(2, '0')}`,
    dateStr: fmt(twDate),
    date:    twDate,
    zone:    summer ? 'CDT' : 'CST',
  };
};

/* ─── Main export ───────────────────────────────────────────────────────────── */

/**
 * @typedef {{ dateStr: string, weekday: string, name: string, products: string, note?: string }} FullCloseEntry
 * @typedef {{ usDateStr: string, usWeekday: string, name: string, products: string,
 *             twDateStr: string, twWeekday: string, twTime: string, ctRef: string }} EarlyCloseEntry
 *
 * @param {number} year
 * @returns {{ fullClose: FullCloseEntry[], earlyClose: EarlyCloseEntry[] }}
 */
const getFuturesHolidays = (year) => {
  /* ── Fixed dates ── */
  const easter         = getEaster(year);
  const goodFriday     = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
  const newYearsDay    = observe(new Date(year, 0,  1));
  const juneteenth     = year >= 2022 ? observe(new Date(year, 5, 19)) : null;
  const independenceDay= observe(new Date(year, 6,  4));
  const christmasDay   = observe(new Date(year, 11, 25));

  /* ── Floating dates ── */
  const mlkDay         = nthWeekday(year, 0,  1, 3);   // 3rd Mon Jan
  const presidentsDay  = nthWeekday(year, 1,  1, 3);   // 3rd Mon Feb
  const memorialDay    = nthWeekday(year, 4,  1, -1);  // Last Mon May
  const laborDay       = nthWeekday(year, 8,  1, 1);   // 1st Mon Sep
  const thanksgiving   = nthWeekday(year, 10, 4, 4);   // 4th Thu Nov

  /* ── Full close list ── */
  const fullClose = [
    { date: newYearsDay,    name: "元旦 (New Year's Day)",            products: 'all' },
    { date: mlkDay,         name: '馬丁路德金紀念日 (MLK Day)',          products: 'all' },
    { date: presidentsDay,  name: "總統日 (Presidents' Day)",          products: 'all' },
    { date: goodFriday,     name: '耶穌受難日 (Good Friday)',           products: 'index_metals',
      note: '能源（CL/NG）電子盤通常照常交易' },
    { date: memorialDay,    name: '陣亡將士紀念日 (Memorial Day)',       products: 'all' },
    ...(juneteenth ? [{ date: juneteenth, name: '六月節 (Juneteenth)', products: 'all' }] : []),
    { date: independenceDay,name: '獨立紀念日 (Independence Day)',      products: 'all' },
    { date: laborDay,       name: '勞動節 (Labor Day)',                products: 'all' },
    { date: thanksgiving,   name: '感恩節 (Thanksgiving Day)',          products: 'all' },
    { date: christmasDay,   name: '聖誕節 (Christmas Day)',             products: 'all' },
  ].sort((a, b) => a.date - b.date);

  const isFullCloseDate = (d) => fullClose.some((h) => fmt(h.date) === fmt(d));

  /* ── Early close list ── */
  const earlyCloseRaw = [];

  const addEarlyClose = (usDate, name, ctHour = 13) => {
    if (!isBizDay(usDate) || isFullCloseDate(usDate)) return;
    const tw = ctToTW(usDate, ctHour, 0);
    earlyCloseRaw.push({
      usDate,
      name,
      products: 'all',
      twTime:   tw.time,
      twDate:   tw.date,
      twDateStr:tw.dateStr,
      ctRef:    `13:00 CT (${tw.zone})`,
    });
  };

  // Independence Day Eve: July 3 is traditionally the half-day before July 4.
  // Only add when July 3 is a regular business day (not the holiday itself).
  const july3 = new Date(year, 6, 3);
  addEarlyClose(july3, '獨立紀念日前夕 (Independence Day Eve)');

  // Thanksgiving Eve = Wednesday before Thanksgiving
  const tksEve = new Date(thanksgiving.getFullYear(), thanksgiving.getMonth(), thanksgiving.getDate() - 1);
  addEarlyClose(tksEve, '感恩節前夕 (Thanksgiving Eve)');

  // Christmas Eve
  addEarlyClose(new Date(year, 11, 24), '平安夜 (Christmas Eve)');

  // New Year's Eve
  addEarlyClose(new Date(year, 11, 31), "除夕跨年 (New Year's Eve)");

  const earlyClose = earlyCloseRaw
    .sort((a, b) => a.usDate - b.usDate)
    .map((e) => ({
      usDateStr: fmt(e.usDate),
      usWeekday: wdZH(e.usDate),
      name:      e.name,
      products:  e.products,
      twDateStr: e.twDateStr,
      twWeekday: wdZH(e.twDate),
      twTime:    e.twTime,
      ctRef:     e.ctRef,
    }));

  return {
    fullClose: fullClose.map((h) => ({
      dateStr:  fmt(h.date),
      weekday:  wdZH(h.date),
      name:     h.name,
      products: h.products,
      note:     h.note || null,
    })),
    earlyClose,
  };
};

export default getFuturesHolidays;
