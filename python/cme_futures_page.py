"""
cme_futures_page.py
===================
Drop-in PySide6 tab widget for CME futures holidays & settlement dates.
Matches the dark-theme style of Global Macro Monitor.

Usage (add as a tab):
    from cme_futures_page import CMEFuturesPage
    tab_widget.addTab(CMEFuturesPage(), "🗓 CME 期貨")

Or run standalone:
    python cme_futures_page.py
"""

import sys
from datetime import date

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QApplication, QFrame, QGridLayout, QHBoxLayout, QLabel,
    QMainWindow, QPushButton, QScrollArea, QSizePolicy, QTabBar,
    QTabWidget, QVBoxLayout, QWidget,
)

from cme_futures import (
    get_dst_dates,
    get_futures_holidays,
    get_futures_settlements,
)

# ─── Colour palette (matches Global Macro Monitor dark theme) ────────────────

BG_MAIN    = "#0d1117"
BG_CARD    = "#161b22"
BG_CARD2   = "#1c2333"
BORDER     = "#21262d"
BORDER_HL  = "#30363d"
TXT_PRI    = "#e6edf3"
TXT_SEC    = "#8b949e"
TXT_MUT    = "#484f58"
BLUE       = "#388bfd"
BLUE_DARK  = "#1f6feb"
GREEN      = "#3fb950"
RED        = "#f85149"
ORANGE     = "#d29922"
PURPLE     = "#bc8cff"

QSS = f"""
/* ── global ── */
* {{
    font-family: 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans CJK TC',
                 'Segoe UI', sans-serif;
    font-size: 13px;
    color: {TXT_PRI};
    background: transparent;
}}

/* ── root widget ── */
#CMERoot {{
    background: {BG_MAIN};
}}

/* ── top tab bar ── */
QTabWidget::pane {{
    border: 1px solid {BORDER};
    border-top: none;
    background: {BG_MAIN};
}}
QTabBar::tab {{
    background: {BG_CARD};
    color: {TXT_SEC};
    padding: 9px 22px;
    border: 1px solid {BORDER};
    border-bottom: none;
    margin-right: 3px;
    border-radius: 8px 8px 0 0;
    font-size: 13px;
}}
QTabBar::tab:selected {{
    background: qlineargradient(
        x1:0, y1:0, x2:0, y2:1,
        stop:0 {BLUE_DARK}, stop:1 {BLUE});
    color: #ffffff;
    border-color: {BLUE};
    font-weight: bold;
}}
QTabBar::tab:hover:!selected {{
    background: {BG_CARD2};
    color: {TXT_PRI};
}}

/* ── scroll area ── */
QScrollArea  {{ border: none; background: {BG_MAIN}; }}
QScrollBar:vertical {{
    background: {BG_CARD};
    width: 7px;
    border-radius: 3px;
}}
QScrollBar::handle:vertical {{
    background: {BORDER_HL};
    border-radius: 3px;
    min-height: 24px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}

/* ── nav buttons ── */
QPushButton#navBtn {{
    background: {BG_CARD2};
    border: 1px solid {BORDER_HL};
    border-radius: 7px;
    padding: 7px 18px;
    color: {TXT_PRI};
    font-size: 13px;
}}
QPushButton#navBtn:hover  {{ background: {BORDER_HL}; border-color: {BLUE}; }}
QPushButton#navBtn:pressed {{ background: {BG_CARD}; }}

/* ── cards ── */
QFrame#card {{
    background: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 10px;
}}
QFrame#card:hover {{
    border-color: {BLUE};
}}

/* ── section header ── */
QLabel#sectionTitle {{
    color: {TXT_PRI};
    font-size: 15px;
    font-weight: bold;
}}
QLabel#sectionSub {{
    color: {TXT_SEC};
    font-size: 11px;
}}

/* ── DST info bar ── */
QLabel#dstBar {{
    background: {BG_CARD2};
    border: 1px solid {BORDER};
    border-radius: 7px;
    padding: 6px 14px;
    color: {TXT_SEC};
    font-size: 12px;
}}

/* ── year display ── */
QLabel#yearLabel {{
    color: {TXT_PRI};
    font-size: 20px;
    font-weight: bold;
    min-width: 80px;
}}

/* ── settlement row ── */
QFrame#settleRow {{
    background: {BG_CARD};
    border: 1px solid {BORDER};
    border-radius: 7px;
}}
QFrame#settleRow:hover {{
    border-color: {BLUE_DARK};
    background: {BG_CARD2};
}}
"""


# ─── Worker thread (compute in background) ───────────────────────────────────

class _Worker(QThread):
    done = Signal(int, dict, dict, dict)  # year, dst, holidays, settlements

    def __init__(self, year: int):
        super().__init__()
        self._year = year

    def run(self):
        y = self._year
        dst  = get_dst_dates(y)
        hols = get_futures_holidays(y)
        sets = get_futures_settlements(y)
        self.done.emit(y, dst, hols, sets)


# ─── Helper builders ─────────────────────────────────────────────────────────

def _label(text: str, style: str = "", obj: str = "") -> QLabel:
    lbl = QLabel(text)
    if style:
        lbl.setStyleSheet(style)
    if obj:
        lbl.setObjectName(obj)
    lbl.setTextInteractionFlags(Qt.TextSelectableByMouse)
    return lbl


def _divider() -> QFrame:
    f = QFrame()
    f.setFrameShape(QFrame.HLine)
    f.setStyleSheet(f"background:{BORDER}; border:none; max-height:1px;")
    return f


def _scroll_wrap(inner: QWidget) -> QScrollArea:
    sa = QScrollArea()
    sa.setWidgetResizable(True)
    sa.setWidget(inner)
    return sa


def _build_holiday_card(entry: dict) -> QFrame:
    """Single holiday card with per-product close info."""
    card = QFrame()
    card.setObjectName("card")
    lay = QVBoxLayout(card)
    lay.setContentsMargins(18, 14, 18, 14)
    lay.setSpacing(7)

    # Date row
    date_row = QHBoxLayout()
    date_row.addWidget(_label(
        f"📅  {entry['dateStr']}  {entry['weekday']}",
        f"color:{TXT_SEC}; font-size:12px;"))
    date_row.addStretch()

    # Detect NFP-on-GoodFriday (abbreviated index session)
    idx = entry['index']
    if idx.get('close') not in ('full', None) and idx['close'] == '08:15':
        nfp_tag = _label("  📊 NFP日", f"color:{PURPLE}; font-size:11px;")
        date_row.addWidget(nfp_tag)

    lay.addLayout(date_row)
    lay.addWidget(_label(entry['name'],
                         f"color:{TXT_PRI}; font-size:15px; font-weight:bold;"))
    lay.addWidget(_divider())

    for icon, key, prod_label in [
        ("📊", "index",  "指數"),
        ("🛢", "energy", "能源"),
        ("🥇", "metals", "貴金屬"),
    ]:
        info = entry[key]
        row = QHBoxLayout()
        row.setSpacing(8)
        row.addWidget(_label(f"{icon} {prod_label}",
                             f"color:{TXT_SEC}; font-size:12px; min-width:68px;"))
        if info['close'] == 'full':
            row.addWidget(_label("全日休市",
                                 f"color:{RED}; font-size:12px; font-weight:bold;"))
        else:
            ct  = f"{info['close']} {info['ctZone']}"
            tw  = f"{info['twDateStr']} {info.get('twWeekday','')} {info['twTime']} TW"
            row.addWidget(_label(f"{ct}",
                                 f"color:{ORANGE}; font-size:12px;"))
            row.addWidget(_label("→", f"color:{TXT_MUT}; font-size:12px;"))
            row.addWidget(_label(tw, f"color:{GREEN}; font-size:12px;"))
        row.addStretch()
        lay.addLayout(row)

    return card


def _build_holidays_tab(holidays: list, dst: dict) -> QWidget:
    """Two-column grid of holiday cards."""
    outer = QWidget()
    outer.setObjectName("CMERoot")
    vlay = QVBoxLayout(outer)
    vlay.setContentsMargins(20, 16, 20, 20)
    vlay.setSpacing(14)

    # DST bar
    dst_s = dst['start'].strftime('%Y-%m-%d') if hasattr(dst['start'], 'strftime') else dst['start']
    dst_e = dst['end'].strftime('%Y-%m-%d')   if hasattr(dst['end'],   'strftime') else dst['end']
    dst_bar = _label(
        f"🕐  CDT (UTC−5) 開始：{dst_s}　｜　CST (UTC−6) 開始：{dst_e}　｜　台灣 UTC+8 (不調時)",
        obj="dstBar")
    dst_bar.setObjectName("dstBar")
    dst_bar.setStyleSheet(f"QLabel{{background:{BG_CARD2}; border:1px solid {BORDER};"
                          f"border-radius:7px; padding:6px 14px;"
                          f"color:{TXT_SEC}; font-size:12px;}}")
    vlay.addWidget(dst_bar)

    # Cards grid
    grid = QGridLayout()
    grid.setSpacing(12)
    for i, entry in enumerate(holidays):
        card = _build_holiday_card(entry)
        grid.addWidget(card, i // 2, i % 2)

    vlay.addLayout(grid)
    vlay.addStretch()
    return _scroll_wrap(outer)


def _build_settle_row(cols: list[tuple]) -> QFrame:
    """One settlement row: list of (text, color) tuples."""
    row = QFrame()
    row.setObjectName("settleRow")
    lay = QHBoxLayout(row)
    lay.setContentsMargins(16, 10, 16, 10)
    lay.setSpacing(16)
    for text, color in cols:
        lbl = _label(text, f"color:{color}; font-size:13px;")
        lay.addWidget(lbl)
    lay.addStretch()
    return row


def _build_index_tab(data: list) -> QWidget:
    outer = QWidget()
    outer.setObjectName("CMERoot")
    vlay = QVBoxLayout(outer)
    vlay.setContentsMargins(24, 20, 24, 20)
    vlay.setSpacing(10)

    vlay.addWidget(_label("📊  指數 ES / NQ / YM  季結算日",
                          f"color:{TXT_PRI}; font-size:16px; font-weight:bold;"))
    vlay.addWidget(_label("規則：每年 3、6、9、12 月第三個週五",
                          f"color:{TXT_SEC}; font-size:12px;"))
    vlay.addSpacing(8)

    for item in data:
        row = _build_settle_row([
            (item['quarter'],   BLUE),
            (item['dateStr'],   TXT_PRI),
            (item['weekday'],   TXT_SEC),
        ])
        vlay.addWidget(row)

    vlay.addStretch()
    return _scroll_wrap(outer)


def _build_monthly_tab(icon: str, title: str, rule_desc: str,
                        data: list) -> QWidget:
    """Generic monthly settlement tab (CL / NG / GC / SI)."""
    outer = QWidget()
    outer.setObjectName("CMERoot")
    vlay = QVBoxLayout(outer)
    vlay.setContentsMargins(24, 20, 24, 20)
    vlay.setSpacing(10)

    vlay.addWidget(_label(f"{icon}  {title}",
                          f"color:{TXT_PRI}; font-size:16px; font-weight:bold;"))
    vlay.addWidget(_label(rule_desc, f"color:{TXT_SEC}; font-size:12px;"))
    vlay.addSpacing(8)

    for item in data:
        row = _build_settle_row([
            (item['month'],    ORANGE),
            (item['dateStr'],  TXT_PRI),
            (item['weekday'],  TXT_SEC),
        ])
        vlay.addWidget(row)

    vlay.addStretch()
    return _scroll_wrap(outer)


# ─── Loading overlay ──────────────────────────────────────────────────────────

class _LoadingWidget(QWidget):
    def __init__(self, year: int):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setAlignment(Qt.AlignCenter)
        lbl = QLabel(f"⏳  載入 {year} 年資料中…")
        lbl.setStyleSheet(f"color:{TXT_SEC}; font-size:15px;")
        lbl.setAlignment(Qt.AlignCenter)
        lay.addWidget(lbl)


# ─── Main page widget ─────────────────────────────────────────────────────────

class CMEFuturesPage(QWidget):
    """
    Drop-in PySide6 widget.  Add to any QTabWidget:

        tab_widget.addTab(CMEFuturesPage(), "🗓 CME 期貨")
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("CMERoot")
        self.setStyleSheet(QSS)
        self._year   = date.today().year
        self._worker = None
        self._setup_ui()
        self._load()

    # ── UI skeleton ──────────────────────────────────────────────────────────

    def _setup_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── header ──────────────────────────────────────────
        header = QWidget()
        header.setStyleSheet(f"background:{BG_CARD2}; border-bottom:1px solid {BORDER};")
        hlay = QHBoxLayout(header)
        hlay.setContentsMargins(24, 16, 24, 16)
        hlay.setSpacing(12)

        # Title
        title = QLabel("🗓  CME 期貨假日 & 結算日")
        title.setStyleSheet(f"color:{TXT_PRI}; font-size:20px; font-weight:bold;")
        hlay.addWidget(title)
        hlay.addStretch()

        # Year navigation
        self._btn_prev = QPushButton("← 前一年")
        self._btn_prev.setObjectName("navBtn")
        self._btn_prev.clicked.connect(self._prev_year)

        self._year_lbl = QLabel(str(self._year))
        self._year_lbl.setObjectName("yearLabel")
        self._year_lbl.setAlignment(Qt.AlignCenter)

        self._btn_next = QPushButton("後一年 →")
        self._btn_next.setObjectName("navBtn")
        self._btn_next.clicked.connect(self._next_year)

        for w in (self._btn_prev, self._year_lbl, self._btn_next):
            hlay.addWidget(w)

        root.addWidget(header)

        # ── content area ─────────────────────────────────────
        self._content = QVBoxLayout()
        self._content.setContentsMargins(0, 0, 0, 0)
        root.addLayout(self._content)

        # placeholder while loading
        self._loading = _LoadingWidget(self._year)
        self._content.addWidget(self._loading)

        self._tabs: QTabWidget | None = None

    # ── data loading ─────────────────────────────────────────────────────────

    def _load(self):
        self._year_lbl.setText(str(self._year))
        if self._tabs:
            self._tabs.hide()
        self._loading.show()

        self._worker = _Worker(self._year)
        self._worker.done.connect(self._on_data)
        self._worker.start()

    def _on_data(self, year: int, dst: dict, holidays: list, settlements: dict):
        if year != self._year:
            return  # stale result from a previous request

        self._loading.hide()

        if self._tabs:
            self._content.removeWidget(self._tabs)
            self._tabs.deleteLater()

        tabs = QTabWidget()
        tabs.setDocumentMode(True)

        tabs.addTab(
            _build_holidays_tab(holidays, dst),
            "📅  假日行事曆")

        tabs.addTab(
            _build_index_tab(settlements['index']),
            "📊  指數 ES/NQ/YM")

        tabs.addTab(
            _build_monthly_tab(
                "🛢", "原油 CL  月結算日",
                "規則：交割月前一月25日前的第3個交易日 (若25日非交易日則取其前一交易日)",
                settlements['cl']),
            "🛢  原油 CL")

        tabs.addTab(
            _build_monthly_tab(
                "⛽", "天然氣 NG  月結算日",
                "規則：交割月第1日前的第3個交易日",
                settlements['ng']),
            "⛽  天然氣 NG")

        tabs.addTab(
            _build_monthly_tab(
                "🥇", "黃金 GC  結算日",
                "規則：交割月（偶數月 Feb/Apr/Jun/Aug/Oct/Dec）倒數第3個交易日",
                settlements['gc']),
            "🥇  黃金 GC")

        tabs.addTab(
            _build_monthly_tab(
                "🥈", "白銀 SI  結算日",
                "規則：交割月（Mar/May/Jul/Sep/Dec）倒數第3個交易日",
                settlements['si']),
            "🥈  白銀 SI")

        self._tabs = tabs
        self._content.addWidget(tabs)

    # ── year navigation ───────────────────────────────────────────────────────

    def _prev_year(self):
        self._year -= 1
        self._load()

    def _next_year(self):
        self._year += 1
        self._load()


# ─── Standalone runner ────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    win = QMainWindow()
    win.setWindowTitle("CME 期貨假日 & 結算日")
    win.resize(1100, 780)
    win.setStyleSheet(f"QMainWindow {{ background: {BG_MAIN}; }}")

    page = CMEFuturesPage()
    win.setCentralWidget(page)
    win.show()

    sys.exit(app.exec())
