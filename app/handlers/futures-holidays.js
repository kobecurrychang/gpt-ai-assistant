import getFuturesHolidays from '../../utils/get-futures-holidays.js';
import { COMMAND_FUTURES_HOLIDAYS } from '../commands/index.js';
import Context from '../context.js';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_FUTURES_HOLIDAYS);

const parseYear = (text) => {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : new Date().getFullYear();
};

/* ─── DST transition dates ───────────────────────────────────────────────── */

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

/**
 * Return DST start/end for a given year (US rules).
 * Start: 2nd Sunday in March (CDT begins, CT = UTC-5)
 * End  : 1st Sunday in November (CST begins, CT = UTC-6)
 */
const getDSTDates = (year) => {
  const start = nthWeekday(year, 2,  0, 2);  // 2nd Sun Mar
  const end   = nthWeekday(year, 10, 0, 1);  // 1st Sun Nov
  return { start, end };
};

/* ─── Format one product row ─────────────────────────────────────────────── */

const row = (label, p) => {
  if (p.close === 'full') return `  ${label}：全日休市`;
  return `  ${label}：提早收市 → 台灣 ${p.twDateStr} ${p.twTime}（${p.twWeekday}）`;
};

/* ─── Build full reply ────────────────────────────────────────────────────── */

const buildReply = (year) => {
  const holidays = getFuturesHolidays(year);
  const { start: dstStart, end: dstEnd } = getDSTDates(year);

  const dstLine = [
    `🕐 ${year} 美國夏令/冬令時間`,
    `  夏令（CDT, CT+13h）：${fmt(dstStart)}（${wdZH(dstStart)}）起`,
    `  冬令（CST, CT+14h）：${fmt(dstEnd)}（${wdZH(dstEnd)}）起`,
    `  正常電子盤收盤：夏令 06:00 ／冬令 07:00（台灣時間）`,
  ].join('\n');

  const lines = holidays.map((h) => {
    const allFull = h.index.close === 'full'
      && h.energy.close === 'full'
      && h.metals.close === 'full';

    if (allFull) {
      return `▸ ${h.dateStr}（${h.weekday}）${h.name}\n  指數 / 能源 / 貴金屬：全日休市`;
    }

    return [
      `▸ ${h.dateStr}（${h.weekday}）${h.name}`,
      row('指數 ES/NQ/YM', h.index),
      row('能源 CL/NG   ', h.energy),
      row('貴金屬 GC/SI ', h.metals),
    ].join('\n');
  });

  return [
    `📅 ${year} CME 美國期貨休市日（台灣時間 UTC+8）`,
    '',
    dstLine,
    '',
    lines.join('\n\n'),
    '',
    '⚠ 精確時間以 CME 官方公告為準',
    'https://www.cmegroup.com/trading-hours.html',
  ].join('\n');
};

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      context.pushText(buildReply(parseYear(context.trimmedText)));
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
