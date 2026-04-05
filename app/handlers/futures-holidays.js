import getFuturesHolidays from '../../utils/get-futures-holidays.js';
import { COMMAND_FUTURES_HOLIDAYS } from '../commands/index.js';
import Context from '../context.js';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_FUTURES_HOLIDAYS);

const parseYear = (text) => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
};

/* ─── Formatting helpers ─────────────────────────────────────────────────── */

/**
 * Render one product's close info.
 * @param {object} p - { close: 'full' | 'HH:MM', twTime, twDateStr, twWeekday, ctZone, offset }
 * @param {string} label - e.g. '指數'
 * @returns {string}
 */
const fmtProduct = (p, label) => {
  if (p.close === 'full') return `  ${label}：全日無交易`;
  return `  ${label}：${p.close} CT (${p.ctZone}) → 台灣 ${p.twDateStr}（${p.twWeekday}）${p.twTime}`;
};

/**
 * Build the formatted reply for one year.
 * @param {number} year
 * @returns {string}
 */
const buildReply = (year) => {
  const holidays = getFuturesHolidays(year);

  const lines = holidays.map((h) => {
    const idxFull    = h.index.close  === 'full';
    const engFull    = h.energy.close === 'full';
    const metFull    = h.metals.close === 'full';
    const allFull    = idxFull && engFull && metFull;

    if (allFull) {
      return `▸ ${h.dateStr}（${h.weekday}）${h.name}\n  全商品全日無交易`;
    }

    const rows = [
      `▸ ${h.dateStr}（${h.weekday}）${h.name}`,
      fmtProduct(h.index,  '指數 ES/NQ/YM'),
      fmtProduct(h.energy, '能源 CL/NG   '),
      fmtProduct(h.metals, '貴金屬 GC/SI '),
    ];
    return rows.join('\n');
  });

  const header = [
    `📅 ${year} 年 CME 美國期貨假期休市時間`,
    '（電子盤 Globex，台灣時間 UTC+8）',
    '正常收盤：夏令 06:00／冬令 07:00 台灣時間',
  ].join('\n');

  const footer = [
    '⚠ CME 通常於假日前 ~2 週發布精確時間。',
    '請至 cmegroup.com/trading-hours.html 確認最新公告。',
  ].join('\n');

  return [header, '', ...lines, '', footer].join('\n');
};

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      const year = parseYear(context.trimmedText);
      context.pushText(buildReply(year));
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
