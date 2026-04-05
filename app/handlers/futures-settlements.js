import getFuturesSettlements from '../../utils/get-futures-settlements.js';
import { COMMAND_FUTURES_SETTLEMENTS } from '../commands/index.js';
import Context from '../context.js';

const check = (context) => context.hasCommand(COMMAND_FUTURES_SETTLEMENTS);

const parseYear = (text) => {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : new Date().getFullYear();
};

const buildReply = (year, s) => {
  const indexLines = s.index.map(
    (r) => `  ${r.quarter}  ${r.dateStr}（${r.weekday}）`,
  ).join('\n');

  const listLines = (arr) => arr.map(
    (r) => `  ${r.month.padEnd(6)}  ${r.dateStr}（${r.weekday}）`,
  ).join('\n');

  return [
    `📅 ${year} CME 期貨結算日 / 最後交易日`,
    '',
    '📊 指數 ES/NQ/YM（季結算）',
    indexLines,
    '',
    '🛢 原油 CL（月結算）',
    listLines(s.cl),
    '',
    '⛽ 天然氣 NG（月結算）',
    listLines(s.ng),
    '',
    '🥇 黃金 GC（偶數月）',
    listLines(s.gc),
    '',
    '🥈 白銀 SI（3/5/7/9/12月）',
    listLines(s.si),
    '',
    '⚠ 以 CME 官方公告為準',
    'https://www.cmegroup.com/trading/equity-index/rolldates.html',
  ].join('\n');
};

const exec = (context) => check(context) && (
  async () => {
    try {
      const year = parseYear(context.trimmedText);
      const s    = getFuturesSettlements(year);
      context.pushText(buildReply(year, s));
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
