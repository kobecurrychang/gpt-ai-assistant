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

/* ─── Format one product row ─────────────────────────────────────────────── */

const row = (label, p) => {
  if (p.close === 'full') return `  ${label}：全日休市`;
  return `  ${label}：提早收市 → 台灣 ${p.twDateStr} ${p.twTime}（${p.twWeekday}）`;
};

/* ─── Build full reply ────────────────────────────────────────────────────── */

const buildReply = (year) => {
  const holidays = getFuturesHolidays(year);

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
    '正常電子盤收盤：夏令 06:00 ／冬令 07:00（台灣時間）',
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
