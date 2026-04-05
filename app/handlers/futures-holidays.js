import getFuturesHolidays from '../../utils/get-futures-holidays.js';
import { COMMAND_FUTURES_HOLIDAYS } from '../commands/index.js';
import Context from '../context.js';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_FUTURES_HOLIDAYS);

/**
 * Parse a 4-digit year from user input. Defaults to current year.
 * @param {string} text
 * @returns {number}
 */
const parseYear = (text) => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
};

const PRODUCTS_LABEL = {
  all:          '能源・指數・貴金屬',
  index_metals: '指數・貴金屬',
};

/**
 * Build the formatted reply text (Traditional Chinese).
 * @param {number} year
 * @returns {string}
 */
const buildReply = (year) => {
  const { fullClose, earlyClose } = getFuturesHolidays(year);

  /* ── Full close section ── */
  const fmtFull = (h) => {
    const line = `▸ ${h.dateStr}（${h.weekday}）${h.name}`;
    return h.note ? `${line}\n  ⚠ ${h.note}` : line;
  };

  const fullSection = [
    `【完全休市 — ${PRODUCTS_LABEL.all}】`,
    ...fullClose.map(fmtFull),
  ].join('\n');

  /* ── Early close section ── */
  const earlySection = earlyClose.length
    ? [
        '【提前休市（電子盤 Globex 台灣時間）】',
        '正常收盤：夏令 06:00／冬令 07:00 台灣時間',
        '',
        ...earlyClose.map((e) => [
          `▸ 美國 ${e.usDateStr}（${e.usWeekday}）${e.name}`,
          `  ${PRODUCTS_LABEL[e.products] || e.products}`,
          `  提前至台灣時間 ${e.twDateStr}（${e.twWeekday}）凌晨 ${e.twTime} 截止`,
          `  （美國中部時間 ${e.ctRef}）`,
        ].join('\n')),
      ].join('\n')
    : '';

  const header = `📅 ${year} 年 CME 美國期貨休市日\n能源（CL/NG）・指數（ES/NQ/YM）・貴金屬（GC/SI）`;
  const footer = '⚠ 以 CME 官方公告為準，請於交易前確認最新時程。';

  return [header, '', fullSection, '', earlySection, '', footer]
    .filter((s) => s !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      const year = parseYear(context.trimmedText);
      const reply = buildReply(year);
      context.pushText(reply);
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
