"""
cme_futures.py – CME/NYMEX/COMEX futures holiday & settlement calculator
========================================================================

Standalone single-file module. No third-party dependencies (stdlib only).

Products covered:
  Index  – ES / NQ / YM (CME)   : full close / early close on US holidays
  Energy – CL / NG (NYMEX)      : full close / early close on US holidays
  Metals – GC / SI (COMEX)      : full close / early close on US holidays

Settlement (last trading day) rules:
  Index  : quarterly, 3rd Friday of Mar / Jun / Sep / Dec
  CL     : monthly, 3rd biz day before the 25th of the prior month
  NG     : monthly, 3rd biz day before the 1st of the delivery month
  GC     : Feb/Apr/Jun/Aug/Oct/Dec, 3rd-to-last biz day of delivery month
  SI     : Mar/May/Jul/Sep/Dec,     3rd-to-last biz day of delivery month

Timezone note:
  All close times are in CT (Central Time).
  CDT = UTC-5  (2nd Sun Mar → 1st Sun Nov)
  CST = UTC-6  (otherwise)
  Taiwan = UTC+8 (no DST)

Usage:
  python cme_futures.py [year]       # print holidays + settlements
  python cme_futures.py 2026
  python cme_futures.py 2026 holidays
  python cme_futures.py 2026 settlements

Or import as a module:
  from cme_futures import get_futures_holidays, get_futures_settlements
"""

import calendar
import json
import os
import sys
from datetime import date, timedelta

# ─── Constants ─────────────────────────────────────────────────────────────────

WD_ZH = ['日', '一', '二', '三', '四', '五', '六']  # JS-style index: 0=Sun

MONTHS_ZH = ['一', '二', '三', '四', '五', '六',
             '七', '八', '九', '十', '十一', '十二']

# Close-time templates (CT "HH:MM" or 'full').
# Source: CME Group annual holiday advisory PDFs.
# ⚠  CME may adjust by a few minutes; verify official advisory before trading.
SCHEDULES = {
    'fullAll':    {'index': 'full',  'energy': 'full',  'metals': 'full'},
    'standard':   {'index': '12:15', 'energy': '12:30', 'metals': '12:30'},
    'memorial':   {'index': '12:00', 'energy': '13:30', 'metals': '13:30'},
    'goodFriAll': {'index': 'full',  'energy': 'full',  'metals': 'full'},
    # Good Friday when NFP (Employment Situation) falls on the same day
    'goodFriNFP': {'index': '08:15', 'energy': 'full',  'metals': 'full'},
}

# JSON cache file (same directory as this script by default)
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'cme-futures-cache.json')

# ─── Date helpers ───────────────────────────────────────────────────────────────

def fmt(d: date) -> str:
    """Format date as 'YYYY-MM-DD'."""
    return d.strftime('%Y-%m-%d')


def _js_weekday(d: date) -> int:
    """Return weekday in JS convention: 0=Sun, 1=Mon … 6=Sat."""
    return (d.weekday() + 1) % 7


def wd_zh(d: date) -> str:
    """Chinese weekday string, e.g. '週一'."""
    return f"週{WD_ZH[_js_weekday(d)]}"


def nth_weekday(year: int, month_0: int, weekday_0: int, n: int) -> date:
    """
    Return the n-th occurrence of a weekday in a month.

    Args:
        year      : calendar year
        month_0   : 0-based month  (0=Jan, 11=Dec)  — JS convention
        weekday_0 : 0-based weekday (0=Sun, 6=Sat)  — JS convention
        n         : positive → n-th from start; negative → n-th from end
                    e.g. n=3 → 3rd occurrence, n=-1 → last occurrence

    Returns: date object
    """
    month = month_0 + 1  # Python date uses 1-based months
    if n > 0:
        first = date(year, month, 1)
        first_wd = _js_weekday(first)
        diff = (weekday_0 - first_wd + 7) % 7
        return date(year, month, 1 + diff + (n - 1) * 7)
    else:
        last_day = calendar.monthrange(year, month)[1]
        last = date(year, month, last_day)
        last_wd = _js_weekday(last)
        diff = (last_wd - weekday_0 + 7) % 7
        return date(year, month, last_day - diff + (n + 1) * 7)


def observe(d: date) -> date:
    """
    Holiday observance rule:
      Saturday  → observed on Friday
      Sunday    → observed on Monday
    """
    wd = _js_weekday(d)
    if wd == 6:  # Saturday
        return d - timedelta(days=1)
    if wd == 0:  # Sunday
        return d + timedelta(days=1)
    return d


# ─── Timezone: CT → Taiwan (UTC+8) ─────────────────────────────────────────────

def is_cdt(d: date) -> bool:
    """True if date falls in US CDT (2nd Sun March → 1st Sun November)."""
    y = d.year
    start = nth_weekday(y, 2, 0, 2)   # 2nd Sunday in March
    end   = nth_weekday(y, 10, 0, 1)  # 1st Sunday in November
    return start <= d < end


def ct_to_tw(us_date: date, ct_str: str) -> dict:
    """
    Convert a CT clock-time on a US date to Taiwan time (UTC+8).

    Args:
        us_date : the US calendar date of the close
        ct_str  : close time as 'HH:MM' in CT

    Returns dict:
        twTime    : 'HH:MM' in Taiwan time
        twDateStr : 'YYYY-MM-DD' of the Taiwan date
        twDate    : date object in Taiwan
        zone      : 'CDT' or 'CST'
        offset    : hours added CT→TW (13 for CDT, 14 for CST)
    """
    ct_h, ct_m = map(int, ct_str.split(':'))
    summer = is_cdt(us_date)
    ct_offset_neg = 5 if summer else 6   # |CT offset from UTC|
    offset         = 13 if summer else 14  # CT → TW hours to add

    ct_min  = ct_h * 60 + ct_m
    utc_min = ct_min + ct_offset_neg * 60
    tw_min  = utc_min + 8 * 60

    day_off = tw_min // 1440
    rem     = tw_min % 1440
    tw_h    = rem // 60
    tw_mi   = rem % 60

    tw_date = us_date + timedelta(days=day_off)
    return {
        'twTime':    f"{tw_h:02d}:{tw_mi:02d}",
        'twDateStr': fmt(tw_date),
        'twDate':    tw_date,
        'zone':      'CDT' if summer else 'CST',
        'offset':    offset,
    }


def get_dst_dates(year: int) -> dict:
    """Return US DST transition dates for the year.

    Returns:
        start : date when CDT begins (2nd Sunday in March)
        end   : date when CST begins (1st Sunday in November)
    """
    return {
        'start': nth_weekday(year, 2, 0, 2),   # 2nd Sun March
        'end':   nth_weekday(year, 10, 0, 1),  # 1st Sun November
    }


# ─── Holiday calendar ──────────────────────────────────────────────────────────

def get_easter(year: int) -> date:
    """Anonymous Gregorian algorithm for Easter Sunday."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day   = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _build_entry(d: date, name: str, schedule: dict) -> dict:
    """Build a holiday entry with per-product close info and Taiwan times."""
    def resolve(ct):
        if ct == 'full':
            return {'close': 'full'}
        tw = ct_to_tw(d, ct)
        return {
            'close':     ct,
            'ctZone':    tw['zone'],
            'twTime':    tw['twTime'],
            'twDateStr': tw['twDateStr'],
            'twWeekday': wd_zh(tw['twDate']),
            'offset':    tw['offset'],
        }
    return {
        'dateStr': fmt(d),
        'weekday': wd_zh(d),
        'name':    name,
        'index':   resolve(schedule['index']),
        'energy':  resolve(schedule['energy']),
        'metals':  resolve(schedule['metals']),
    }


def get_futures_holidays(year: int) -> list:
    """
    Return sorted list of CME/NYMEX/COMEX holiday entries for the given year.

    Each entry is a dict:
        dateStr  : 'YYYY-MM-DD'
        weekday  : '週X' (Chinese)
        name     : holiday name (Chinese + English)
        index    : { close, ctZone, twTime, twDateStr, twWeekday, offset }
                   or { close: 'full' }
        energy   : same structure
        metals   : same structure
    """
    easter      = get_easter(year)
    good_friday = easter - timedelta(days=2)

    # NFP (Employment Situation) is released on the first Friday of each month.
    # Check if Good Friday IS the first Friday of its month.
    first_fri_of_month = nth_weekday(
        good_friday.year, good_friday.month - 1, 5, 1)  # month-1 for 0-based
    nfp_on_gf = (first_fri_of_month == good_friday)

    mlk_day        = nth_weekday(year, 0, 1, 3)    # 3rd Monday Jan
    presidents_day = nth_weekday(year, 1, 1, 3)    # 3rd Monday Feb
    memorial_day   = nth_weekday(year, 4, 1, -1)   # last Monday May
    independence   = observe(date(year, 7, 4))      # July 4 observed
    labor_day      = nth_weekday(year, 8, 1, 1)    # 1st Monday Sep
    thanksgiving   = nth_weekday(year, 10, 4, 4)   # 4th Thursday Nov
    christmas      = observe(date(year, 12, 25))    # Dec 25 observed
    new_years      = observe(date(year, 1, 1))      # Jan 1 observed

    entries = [
        _build_entry(new_years,      "元旦 (New Year's Day)",        SCHEDULES['fullAll']),
        _build_entry(mlk_day,        '馬丁路德金紀念日 (MLK Day)',     SCHEDULES['standard']),
        _build_entry(presidents_day, "總統日 (Presidents' Day)",     SCHEDULES['standard']),
        _build_entry(good_friday,    '耶穌受難日 (Good Friday)',
                     SCHEDULES['goodFriNFP'] if nfp_on_gf else SCHEDULES['goodFriAll']),
        _build_entry(memorial_day,   '陣亡將士紀念日 (Memorial Day)', SCHEDULES['memorial']),
        _build_entry(independence,   '獨立紀念日 (Independence Day)', SCHEDULES['standard']),
        _build_entry(labor_day,      '勞動節 (Labor Day)',            SCHEDULES['memorial']),
        _build_entry(thanksgiving,   '感恩節 (Thanksgiving Day)',     SCHEDULES['fullAll']),
        _build_entry(christmas,      '聖誕節 (Christmas Day)',        SCHEDULES['fullAll']),
    ]

    # Juneteenth: federal holiday since 2022
    if year >= 2022:
        juneteenth = observe(date(year, 6, 19))
        entries.append(
            _build_entry(juneteenth, '六月節 (Juneteenth)', SCHEDULES['standard']))

    return sorted(entries, key=lambda x: x['dateStr'])


# ─── Settlement / last-trading-day calculator ──────────────────────────────────

def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5  # Saturday=5, Sunday=6


def _make_holiday_set(*years: int) -> set:
    """Build a set of 'YYYY-MM-DD' strings for all CME holidays in the given years."""
    s = set()
    for year in years:
        for h in get_futures_holidays(year):
            s.add(h['dateStr'])
    return s


def _is_biz_day(d: date, h_set: set) -> bool:
    return not _is_weekend(d) and fmt(d) not in h_set


def _n_biz_days_before(anchor: date, n: int, h_set: set) -> date:
    """Return the n-th business day strictly BEFORE anchor, counting backwards."""
    d = anchor - timedelta(days=1)
    count = 0
    while count < n:
        if _is_biz_day(d, h_set):
            count += 1
        if count < n:
            d -= timedelta(days=1)
    return d


def _nth_to_last_biz_day(year: int, month_0: int, n: int, h_set: set) -> date:
    """n-th business day from the end of the month (n=1 → last, n=3 → 3rd-to-last)."""
    month = month_0 + 1
    last_day = calendar.monthrange(year, month)[1]
    d = date(year, month, last_day)
    count = 0
    while True:
        if _is_biz_day(d, h_set):
            count += 1
            if count == n:
                return d
        d -= timedelta(days=1)


def _cl_last_trade(delivery_year: int, delivery_month_0: int, h_set: set) -> date:
    """
    CL (WTI Crude Oil) last trading day.

    Rule: 3rd biz day before the 25th of the month PRECEDING delivery.
    If the 25th itself is not a business day, use the last biz day before it.
    """
    pm_0 = 11 if delivery_month_0 == 0 else delivery_month_0 - 1
    py   = delivery_year - 1 if delivery_month_0 == 0 else delivery_year
    the25  = date(py, pm_0 + 1, 25)
    anchor = the25 if _is_biz_day(the25, h_set) else _n_biz_days_before(the25, 1, h_set)
    return _n_biz_days_before(anchor, 3, h_set)


def _ng_last_trade(delivery_year: int, delivery_month_0: int, h_set: set) -> date:
    """
    NG (Natural Gas) last trading day.

    Rule: 3rd biz day before the 1st calendar day of the delivery month.
    """
    the1st = date(delivery_year, delivery_month_0 + 1, 1)
    return _n_biz_days_before(the1st, 3, h_set)


def _metal_last_trade(year: int, month_0: int, h_set: set) -> date:
    """GC / SI last trading day: 3rd-to-last biz day of the delivery month."""
    return _nth_to_last_biz_day(year, month_0, 3, h_set)


def get_futures_settlements(year: int) -> dict:
    """
    Return settlement (last trading day) info for all major CME products for year.

    Returns dict with keys: index, cl, ng, gc, si
      index : list of { quarter, dateStr, weekday }
      cl    : list of { month, dateStr, weekday }  (12 months)
      ng    : list of { month, dateStr, weekday }  (12 months)
      gc    : list of { month, dateStr, weekday }  (6 even months)
      si    : list of { month, dateStr, weekday }  (5 months)
    """
    # Need prior-year holidays because Jan CL/NG settlement falls in year-1
    h_set = _make_holiday_set(year - 1, year)

    # Index – 3rd Friday of Mar/Jun/Sep/Dec
    index_months_0 = [2, 5, 8, 11]
    quarters       = ['Q1', 'Q2', 'Q3', 'Q4']
    index = []
    for i, m in enumerate(index_months_0):
        d = nth_weekday(year, m, 5, 3)  # weekday_0=5 → Friday
        index.append({'quarter': quarters[i], 'dateStr': fmt(d), 'weekday': wd_zh(d)})

    # CL – all 12 delivery months
    cl = []
    for m in range(12):
        d = _cl_last_trade(year, m, h_set)
        cl.append({'month': f'{MONTHS_ZH[m]}月合約', 'dateStr': fmt(d), 'weekday': wd_zh(d)})

    # NG – all 12 delivery months
    ng = []
    for m in range(12):
        d = _ng_last_trade(year, m, h_set)
        ng.append({'month': f'{MONTHS_ZH[m]}月合約', 'dateStr': fmt(d), 'weekday': wd_zh(d)})

    # GC – Feb/Apr/Jun/Aug/Oct/Dec  (0-based: 1,3,5,7,9,11)
    gc_months_0 = [1, 3, 5, 7, 9, 11]
    gc = []
    for m in gc_months_0:
        d = _metal_last_trade(year, m, h_set)
        gc.append({'month': f'{MONTHS_ZH[m]}月合約', 'dateStr': fmt(d), 'weekday': wd_zh(d)})

    # SI – Mar/May/Jul/Sep/Dec  (0-based: 2,4,6,8,11)
    si_months_0 = [2, 4, 6, 8, 11]
    si = []
    for m in si_months_0:
        d = _metal_last_trade(year, m, h_set)
        si.append({'month': f'{MONTHS_ZH[m]}月合約', 'dateStr': fmt(d), 'weekday': wd_zh(d)})

    return {'index': index, 'cl': cl, 'ng': ng, 'gc': gc, 'si': si}


# ─── Optional JSON cache ───────────────────────────────────────────────────────

def load_cache(year: int) -> dict | None:
    """Load cached holidays+settlements for year. Returns None on miss or error."""
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        entry = data.get(str(year))
        if entry:
            return entry
    except Exception:
        pass
    return None


def save_cache(year: int, payload: dict) -> None:
    """Persist payload for year into the JSON cache file. Silent on error."""
    try:
        data = {}
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            pass
        data[str(year)] = payload
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def get_or_cache(year: int) -> dict:
    """
    Return { dst, holidays, settlements } for year, using cache if available.
    Saves to cache on first computation.
    """
    cached = load_cache(year)
    if cached:
        return cached
    payload = {
        'cachedAt':    date.today().isoformat(),
        'dst':         {k: fmt(v) for k, v in get_dst_dates(year).items()},
        'holidays':    get_futures_holidays(year),
        'settlements': get_futures_settlements(year),
    }
    save_cache(year, payload)
    return payload


# ─── Formatted output helpers ──────────────────────────────────────────────────

def format_holidays(year: int, holidays: list, dst: dict | None = None) -> str:
    """Return a human-readable string of CME holiday info."""
    lines = [f"📅 {year} CME 期貨市場假日 / 提早收盤"]
    if dst:
        # dst values may be date objects or strings
        start = dst['start'] if isinstance(dst['start'], str) else fmt(dst['start'])
        end   = dst['end']   if isinstance(dst['end'],   str) else fmt(dst['end'])
        lines.append(f"🕐 DST: CDT 開始 {start}，CST 開始 {end}")
    lines.append("")
    for h in holidays:
        lines.append(f"【{h['dateStr']} {h['weekday']}】{h['name']}")
        for product, label in [('index', '指數'), ('energy', '能源'), ('metals', '貴金屬')]:
            info = h[product]
            if info['close'] == 'full':
                lines.append(f"  {label}: 全日休市")
            else:
                lines.append(
                    f"  {label}: {info['close']} {info['ctZone']}"
                    f" → {info['twDateStr']} {info['twWeekday']} {info['twTime']} TW"
                )
    return "\n".join(lines)


def format_settlements(year: int, s: dict) -> str:
    """Return a human-readable string of CME settlement / last-trade dates."""
    lines = [f"📅 {year} CME 期貨結算日 / 最後交易日", ""]

    lines.append("📊 指數 ES/NQ/YM（季結算，3rd Friday of Mar/Jun/Sep/Dec）")
    for q in s['index']:
        lines.append(f"  {q['quarter']}: {q['dateStr']} {q['weekday']}")
    lines.append("")

    lines.append("🛢 原油 CL（月結算）")
    for item in s['cl']:
        lines.append(f"  {item['month']}: {item['dateStr']} {item['weekday']}")
    lines.append("")

    lines.append("⛽ 天然氣 NG（月結算）")
    for item in s['ng']:
        lines.append(f"  {item['month']}: {item['dateStr']} {item['weekday']}")
    lines.append("")

    lines.append("🥇 黃金 GC（偶數月 Feb/Apr/Jun/Aug/Oct/Dec）")
    for item in s['gc']:
        lines.append(f"  {item['month']}: {item['dateStr']} {item['weekday']}")
    lines.append("")

    lines.append("🥈 白銀 SI（Mar/May/Jul/Sep/Dec）")
    for item in s['si']:
        lines.append(f"  {item['month']}: {item['dateStr']} {item['weekday']}")

    return "\n".join(lines)


# ─── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = sys.argv[1:]
    year = int(args[0]) if args and args[0].isdigit() else date.today().year
    mode = args[1] if len(args) > 1 else 'all'

    dst         = get_dst_dates(year)
    holidays    = get_futures_holidays(year)
    settlements = get_futures_settlements(year)

    if mode in ('holidays', 'h'):
        print(format_holidays(year, holidays, dst))
    elif mode in ('settlements', 's'):
        print(format_settlements(year, settlements))
    else:
        print(format_holidays(year, holidays, dst))
        print()
        print("=" * 60)
        print()
        print(format_settlements(year, settlements))
