import fetchCmeAdvisory, { CME_ADV_BASE } from '../../utils/fetch-cme-advisory.js';
import getFuturesHolidays from '../../utils/get-futures-holidays.js';
import { COMMAND_FUTURES_HOLIDAYS } from '../commands/index.js';
import Context from '../context.js';

const CME_TH_URL = 'https://www.cmegroup.com/trading-hours.html';

/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => context.hasCommand(COMMAND_FUTURES_HOLIDAYS);

/**
 * Parse year from user text. Defaults to current year.
 * @param {string} text
 * @returns {number}
 */
const parseYear = (text) => {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : new Date().getFullYear();
};

/**
 * Detect "重新整理" / "force refresh" keywords in user input.
 * @param {string} text
 * @returns {boolean}
 */
const parseForceRefresh = (text) => /重新整理|更新|refresh|force/i.test(text);

/* ─── Schedule formatting ────────────────────────────────────────────────── */

const fmtProduct = (p, label) => {
  if (p.close === 'full') return `  ${label}：全日無交易`;
  return `  ${label}：${p.close} CT (${p.ctZone}) → 台灣 ${p.twDateStr}（${p.twWeekday}）${p.twTime}`;
};

const buildSchedule = (year) => {
  const holidays = getFuturesHolidays(year);
  return holidays.map((h) => {
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
  }).join('\n\n');
};

/* ─── Advisory / cache section ───────────────────────────────────────────── */

/**
 * Format a fetched-at ISO timestamp to a human-readable string.
 * @param {string|null} iso
 * @returns {string}
 */
const fmtFetchedAt = (iso) => {
  if (!iso) return '未知';
  try {
    return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  } catch {
    return iso;
  }
};

/**
 * Build the live/cache status + advisory links section.
 * @param {{ advisoryLinks, source, fetchedAt, isSPA, pageReachable }} live
 * @param {number} year
 * @returns {string}
 */
const buildAdvisorySection = (live, year) => {
  const lines = [];

  // ── Source status line ──
  switch (live.source) {
    case 'cache':
      lines.push(`📁 資料來源：本機快取（更新於 ${fmtFetchedAt(live.fetchedAt)}）`);
      lines.push('   輸入「重新整理」可強制向 CME 官網更新');
      break;
    case 'live':
      lines.push(`🌐 資料來源：CME 官網即時查詢（${fmtFetchedAt(live.fetchedAt)}）`);
      if (live.isSPA) lines.push('   ⚠ 官網為動態頁面，以下時間為靜態參考資料');
      break;
    case 'stale-cache':
      lines.push(`⚠ CME 官網無法連線，使用過期快取（更新於 ${fmtFetchedAt(live.fetchedAt)}）`);
      break;
    default:
      lines.push('⚠ 無法連線至 CME 官網，以下時間為靜態參考資料');
  }

  // ── Advisory PDF links ──
  if (live.advisoryLinks && live.advisoryLinks.length > 0) {
    lines.push('');
    lines.push(`【CME Clearing Advisory PDF（${year}）】`);
    for (const { name, url } of live.advisoryLinks) {
      lines.push(`  ${name}`);
      lines.push(`  ${url}`);
    }
    lines.push('  ↑ 以上 PDF 由 CME 於假日前 ~2 週發布，為最精確來源');
  } else {
    lines.push('');
    lines.push(`【CME Advisory PDF（${year}）尚未全數發布】`);
    lines.push(`  CME 通常於假日前 ~2 週發布各假日 PDF`);
    lines.push(`  請至 ${CME_ADV_BASE}/${year}/ 確認`);
  }

  lines.push('');
  lines.push(`🔗 官方查詢：${CME_TH_URL}`);

  return lines.join('\n');
};

/* ─── Handler ────────────────────────────────────────────────────────────── */

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    try {
      const year    = parseYear(context.trimmedText);
      const refresh = parseForceRefresh(context.trimmedText);

      // Run live fetch and static schedule in parallel
      const [live, schedule] = await Promise.all([
        fetchCmeAdvisory(year, refresh).catch(() => ({
          advisoryLinks: [],
          source:        'none',
          fetchedAt:     null,
          isSPA:         true,
          pageReachable: false,
        })),
        Promise.resolve(buildSchedule(year)),
      ]);

      const header = [
        `📅 ${year} 年 CME 美國期貨假期休市時間`,
        '（電子盤 Globex，台灣時間 UTC+8）',
        '正常收盤：夏令 06:00／冬令 07:00 台灣時間',
      ].join('\n');

      const advisory = buildAdvisorySection(live, year);

      context.pushText([header, '', schedule, '', advisory].join('\n').trim());
    } catch (err) {
      context.pushError(err);
    }
    return context;
  }
)();

export default exec;
