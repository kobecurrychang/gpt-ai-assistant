import fetchCmeAdvisory from '../../utils/fetch-cme-advisory.js';
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

const fmtProduct = (p, label) => {
  if (p.close === 'full') return `  ${label}：全日無交易`;
  return `  ${label}：${p.close} CT (${p.ctZone}) → 台灣 ${p.twDateStr}（${p.twWeekday}）${p.twTime}`;
};

/**
 * Build the schedule section (static hardcoded data).
 * @param {number} year
 * @returns {string}
 */
const buildSchedule = (year) => {
  const holidays = getFuturesHolidays(year);

  const lines = holidays.map((h) => {
    const allFull = h.index.close === 'full' && h.energy.close === 'full' && h.metals.close === 'full';
    if (allFull) {
      return `▸ ${h.dateStr}（${h.weekday}）${h.name}\n  全商品全日無交易`;
    }
    return [
      `▸ ${h.dateStr}（${h.weekday}）${h.name}`,
      fmtProduct(h.index,  '指數 ES/NQ/YM'),
      fmtProduct(h.energy, '能源 CL/NG   '),
      fmtProduct(h.metals, '貴金屬 GC/SI '),
    ].join('\n');
  });

  return lines.join('\n\n');
};

/**
 * Build advisory links section from live fetch result.
 * @param {{ advisoryLinks, isSPA, pageReachable }} live
 * @param {number} year
 * @returns {string}
 */
const buildAdvisorySection = (live, year) => {
  const parts = [];

  if (!live.pageReachable) {
    parts.push('⚠ 無法連線至 CME 官網，以下時間為靜態資料');
  } else if (live.isSPA) {
    parts.push('ℹ CME 官網為動態頁面，以下時間為靜態參考資料');
    parts.push(`  請至 ${CME_TH_URL} 選擇日期查詢最新資料`);
  }

  if (live.advisoryLinks && live.advisoryLinks.length > 0) {
    parts.push('');
    parts.push(`【CME 官方 Clearing Advisory（${year}）】`);
    live.advisoryLinks.forEach(({ name, url }) => {
      // Shorten URL to basename for display
      const file = url.split('/').pop();
      parts.push(`  ${name}：${file}`);
      parts.push(`  ${url}`);
    });
    parts.push('  ⬆ 以上 PDF 為 CME 精確公告，假日前 ~2 週更新');
  } else if (live.pageReachable) {
    parts.push('');
    parts.push(`【CME 官方 Advisory PDF（${year}）尚未全部發布】`);
    parts.push('  CME 通常於假日前 ~2 週發布各假日 PDF');
    parts.push(`  請定期至 ${CME_ADV_BASE}/${year}/ 確認`);
  }

  return parts.join('\n');
};

const CME_TH_URL   = 'https://www.cmegroup.com/trading-hours.html';
const CME_ADV_BASE = 'https://www.cmegroup.com/tools-information/holiday-calendar/files';

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      const year = parseYear(context.trimmedText);

      // 1. Try live CME fetch (non-blocking, best-effort)
      const live = await fetchCmeAdvisory(year).catch(() => ({
        advisoryLinks: [],
        isSPA: true,
        pageReachable: false,
      }));

      // 2. Build reply from static schedule + live advisory links
      const header = [
        `📅 ${year} 年 CME 美國期貨假期休市時間`,
        '（電子盤 Globex，台灣時間 UTC+8）',
        '正常收盤：夏令 06:00／冬令 07:00 台灣時間',
      ].join('\n');

      const schedule = buildSchedule(year);
      const advisory = buildAdvisorySection(live, year);

      const reply = [header, '', schedule, '', advisory].join('\n').trim();
      context.pushText(reply);
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
