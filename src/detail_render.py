# -*- coding: utf-8 -*-
"""Render dashboard/events/<id>.html for every item (used by build_dashboard.py)."""
import html, json, os, re, datetime, subprocess
E = lambda s: html.escape(str(s if s is not None else ''), quote=True)
_BJ = datetime.timezone(datetime.timedelta(hours=8))
_ISO = re.compile(r'^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$')
_UTC_LABEL = re.compile(r'^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*UTC$', re.I)
_CLOCK_UTC = re.compile(r'^(\d{1,2}):(\d{2})\s*UTC$', re.I)
_INLINE_TS = re.compile(r'\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\s*UTC|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})|\d{1,2}:\d{2}\s*UTC', re.I)
def parse_dt(s, anchor=None):
    if s is None: return None
    s = str(s).strip()
    m = _ISO.match(s)
    if m:
        sec = m.group(6) or '00'
        tz = m.group(7) or 'Z'
        if tz == 'Z': tz = '+00:00'
        elif re.fullmatch(r'[+-]\d{4}', tz): tz = tz[:3] + ':' + tz[3:]
        return datetime.datetime.fromisoformat(f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{sec}{tz}")
    m = _UTC_LABEL.match(s)
    if m:
        sec = m.group(6) or '00'
        return datetime.datetime.fromisoformat(f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{sec}+00:00")
    if anchor is not None:
        m = _CLOCK_UTC.match(s)
        if m:
            return datetime.datetime(anchor.year, anchor.month, anchor.day, int(m.group(1)), int(m.group(2)), tzinfo=datetime.timezone.utc)
    return None
def time_tag(dt):
    utc = dt.astimezone(datetime.timezone.utc)
    iso = utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    label = utc.astimezone(_BJ).strftime('%Y-%m-%d %H:%M')
    return f'<time datetime="{iso}">{label}</time>'
def html_with_times(text, anchor=None):
    """Escape text. Wrap UTC/ISO timestamps in <time datetime="…Z">; default label is Beijing."""
    if text is None: return ''
    text = str(text)
    out, i = [], 0
    for m in _INLINE_TS.finditer(text):
        out.append(E(text[i:m.start()]))
        dt = parse_dt(m.group(0), anchor)
        out.append(time_tag(dt) if dt else E(m.group(0)))
        i = m.end()
    out.append(E(text[i:]))
    return ''.join(out)
NA = '<p class="na">暂无数据</p>'
TYPES = {'bigtech': '大厂八卦', 'adr': '美股中概&出海', 'alert': '快讯', 'daily': '每日总结'}
_TRACKER_ALIASES = ('滴滴 & 滴滴出海', '滴滴 & 出海', '滴滴 & DiDi 出海')
_TRACKER_NAME = None
def tracker_name():
    global _TRACKER_NAME
    if _TRACKER_NAME: return _TRACKER_NAME
    import build_dashboard
    name = '滴滴'
    for t in build_dashboard.load_topics()[0]:
        if '滴滴' in (t.get('name') or ''):
            name = t['name']; break
    _TRACKER_NAME = name
    return name
def display_label(text, name=None):
    raw = '' if text is None else str(text)
    trimmed = raw.strip()
    if not trimmed: return raw
    core = re.sub(r'^[^\u4e00-\u9fffA-Za-z0-9]+', '', trimmed)
    lead = trimmed[:len(trimmed) - len(core)]
    label = name or tracker_name()
    for alias in _TRACKER_ALIASES:
        if core == alias or core.startswith(alias):
            return lead + label + core[len(alias):]
    return raw
def fmt(n):
    if n is None: return '—'
    n = float(n)
    return (f'{n/1e4:.1f}万' if n >= 1e4 else f'{int(n):,}')
_EXT = {}
_BITS = {}
def link(url, label=None):
    if not url: return ''
    lab = label if label is not None else url
    hit = _EXT.get(str(url) + '\n' + str(lab))
    if hit: return hit
    return f'<a class="ext" href="{E(url)}" target="_blank" rel="noopener"><span>{E(lab)}</span></a>'
def _slim(it):
    return {k: v for k, v in it.items() if not str(k).startswith('_')}
def _pairs(items):
    pairs = []
    def add(url, label):
        if url: pairs.append({'url': url, 'label': label if label is not None else url})
    for it in items:
        d = it.get('detail') or {}
        for l in it.get('links') or []: add(l.get('url'), l.get('label'))
        for x in d.get('extra_sources') or []: add(x.get('url'), x.get('label'))
        for t in d.get('timeline') or []: add(t.get('url'), '↗')
        for c in d.get('comments') or []: add(c.get('url'), '原文↗')
        for r in d.get('responses') or []: add(r.get('url'), '来源↗')
        add((d.get('weibo') or {}).get('url'), '来源↗')
        for o in d.get('other_platforms') or []: add(o.get('url'), '↗')
        for p in d.get('x_posts') or []: add(p.get('url'), '原链接（站外）')
    return pairs
def load_bits(all_items):
    global _EXT, _BITS
    if _BITS: return
    payload = {'items': [_slim(it) for it in all_items], 'posts': XCACHE, 'pairs': _pairs(all_items)}
    proc = subprocess.run(
        ['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'post_ui.js'), 'renderBits'],
        input=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.decode('utf-8', 'replace')[:2000] or 'post_ui renderBits failed')
    pack = json.loads(proc.stdout.decode('utf-8'))
    _EXT = pack.get('ext') or {}
    _BITS = pack.get('byId') or {}
def bar_chart(labels, values, w=640, h=180):
    if not values: return ''
    mx = max(values) or 1; n = len(values); bw = (w - 40) / n
    out = [f'<svg class="chart" viewBox="0 0 {w} {h+30}" width="100%" role="img">']
    for i, (l, v) in enumerate(zip(labels, values)):
        bh = (h - 20) * v / mx; x = 30 + i * bw; y = h - bh
        out.append(f'<rect x="{x+bw*.15:.1f}" y="{y:.1f}" width="{bw*.7:.1f}" height="{bh:.1f}" rx="3" fill="var(--acc)" opacity="{0.45 if "*" in l else 0.9}"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{y-4:.1f}" text-anchor="middle" class="tv">{fmt(v)}</text>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{h+16}" text-anchor="middle" class="tl">{E(l)}</text>')
    out.append(f'<line x1="26" y1="{h}" x2="{w-6}" y2="{h}" stroke="var(--line)"/></svg>')
    return ''.join(out)
def hbars(post):
    ms = [('views', '浏览'), ('likes', '点赞'), ('reposts', '转发'), ('replies', '回复'), ('quotes', '引用'), ('bookmarks', '收藏')]
    vals = [(n, post.get(k)) for k, n in ms if post.get(k) is not None]
    if not vals: return ''
    eng = [v for n, v in vals if n != '浏览']; mx = max(eng) if eng else 1; mx = mx or 1
    rows = []
    for n, v in vals:
        pct = 100 if n == '浏览' else 100 * v / mx
        rows.append(f'<div class="hb"><span>{n}</span><div class="trk"><i style="width:{pct:.1f}%"></i></div><b>{fmt(v)}</b></div>')
    return '<div class="hbars">' + ''.join(rows) + '<div class="note">互动类指标按本帖最大互动值归一，浏览量单独满格</div></div>'
CSS = '''
:root{--bg:#0d1117;--card:#1a2130;--line:#283244;--tx:#e6edf3;--mut:#8b98ab;--acc:#ff6b4a;--acc2:#4f8cff;--ok:#22c55e;--rumor:#a78bfa;--warn:#f59e0b}
[data-theme=paper]{--bg:#f4ecd8;--card:#fbf6e9;--line:#cbbd9b;--tx:#211c14;--mut:#6d6250;--acc:#8b1e1e;--acc2:#7a3b0c;--ok:#2f6b2f;--rumor:#6b3fa0;--warn:#8b5a00}
[data-theme=paper] body{font-family:"Noto Serif CJK SC","Source Han Serif SC",serif}
[data-theme=feed]{--bg:#f2f3f5;--card:#fff;--line:#e8eaee;--tx:#15181d;--mut:#7a818c;--acc:#fe2c55;--acc2:#1677ff}
[data-theme=hot]{--bg:#fff7f3;--card:#fff;--line:#f3dfd6;--tx:#222;--mut:#8a8a8a;--acc:#ff4d1a;--acc2:#eb7350}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:"Noto Sans CJK SC","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;font-size:15px;line-height:1.75}
a{color:var(--acc2)}a.ext{display:inline-flex;align-items:center;gap:4px}.plogo{width:16px;height:16px;flex:none;display:block}.wrap{max-width:920px;margin:0 auto;padding:0 20px 50px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:14px 0;font-size:13px;color:var(--mut)}
.topbar .crumb{margin-left:auto;text-align:right}
.tz{display:inline-flex;flex-shrink:0;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--card)}
.tz button{background:transparent;color:var(--tx);border:0;font:inherit;padding:6px 12px;min-height:36px;cursor:pointer;line-height:1.3}
.tz button.on{background:var(--acc);color:#fff;font-weight:700}
time{font-variant-numeric:tabular-nums}
@media(max-width:430px){
 .wrap{padding:0 12px 40px}h1{font-size:22px}
 .topbar{align-items:flex-start}.topbar .crumb{flex:1 1 100%;margin-left:0;text-align:left;font-size:12px}
 .tz{order:3;width:100%}.tz button{flex:1;min-height:44px;font-size:15px}
}
h1{font-size:28px;line-height:1.35;margin:6px 0 10px}
.meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.pill{background:var(--acc);color:#fff;border-radius:999px;padding:1px 12px;font-weight:700}
.badge{border-radius:6px;padding:0 7px;font-size:12.5px;font-weight:700}.b-real{color:var(--ok);border:1px solid var(--ok)}.b-rum{color:var(--rumor);border:1px solid var(--rumor)}
.src{font-size:12px;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:0 6px}
.summary{background:var(--card);border-left:4px solid var(--acc);padding:14px 18px;border-radius:0 10px 10px 0;font-size:16px}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-top:18px}
section h2{margin:0 0 10px;font-size:18px}.na{color:var(--mut);font-style:italic;margin:0}.note{font-size:12px;color:var(--mut);overflow-wrap:anywhere}
.xbody{margin:8px 0;padding:8px 10px;border-left:3px solid var(--acc2);background:color-mix(in srgb,var(--acc2) 8%,transparent);border-radius:0 10px 10px 0}
.xtext{white-space:pre-wrap;margin:4px 0}.xmiss{color:var(--warn);font-weight:800}
.xmeta{font-size:12.5px}.heat-how{font-size:12.5px;color:var(--mut);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0}
.heat-how b{color:var(--tx)}.heat-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.heat-brief{margin:2px 0 0}.heat-full{display:none}.heat-how.is-open .heat-full{display:block}.heat-how.is-open .heat-brief{display:none}
.heat-how .xmore{min-height:44px;border:0;background:transparent;color:var(--acc);font:inherit;font-weight:800;cursor:pointer}
.chart{max-width:100%;height:auto}
.tl{border-left:2px solid var(--line);padding-left:18px;margin-left:6px}.tli{position:relative;margin-bottom:10px}.tli:before{content:"";position:absolute;left:-25px;top:8px;width:12px;height:12px;border-radius:50%;background:var(--acc)}
.tli .d{font-weight:700;color:var(--acc);margin-right:8px;font-variant-numeric:tabular-nums}
.post{border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:10px}
.hb{display:grid;grid-template-columns:44px 1fr 70px;gap:8px;align-items:center;font-size:13px}.trk{height:10px;background:var(--line);border-radius:5px;overflow:hidden}.trk i{display:block;height:100%;background:var(--acc)}.hb b{text-align:right}
.chart .tv{font-size:11px;fill:var(--tx)}.chart .tl{font-size:11px;fill:var(--mut)}
.cmt{border-left:3px solid var(--line);padding:6px 12px;margin:10px 0}.cmt q{font-size:15px}.cmt .by{font-size:12.5px;color:var(--mut);margin-top:4px}
.st{border-radius:4px;padding:0 6px;font-size:12px;color:#fff;margin-right:6px}.st-支持{background:#16a34a}.st-质疑{background:#dc2626}.st-调侃{background:#d97706}
.resp{margin:10px 0}.resp b{display:block}
ul{padding-left:20px;margin:6px 0}
.kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.kv div{border:1px solid var(--line);border-radius:8px;padding:8px 12px}
.ui-toggle{min-height:44px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--tx);font:inherit;font-weight:700;cursor:pointer}
html[data-ui=new]{--bg:#ECE7DE;--card:#F7F3EC;--line:#E4DFD6;--tx:#1F1D1A;--mut:#6E665A;--acc:#9E2B1F;--acc2:#4A6FA5;--ok:#3F6B4A;--warn:#C9824A;--rumor:#9A5A2B}
html[data-ui=new] body{background:#ECE7DE;color:#1F1D1A;font-family:"Noto Serif CJK SC","Source Han Serif SC","Songti SC",serif}
html[data-ui=new] h1,html[data-ui=new] h2{font-family:"Noto Serif CJK SC","Source Han Serif SC","Songti SC",serif;font-weight:900}
html[data-ui=new] section{background:#F7F3EC;border-color:#E4DFD6;box-shadow:0 1px 2px rgba(60,45,30,.05)}
html[data-ui=new] .summary{background:#F7F3EC;border-left-color:#9E2B1F}
html[data-ui=new] .tz button.on{background:#4A6FA5;color:#fff}
html[data-ui=new] .pill{background:#9E2B1F}
html[data-ui=new] a{color:#4A6FA5}
'''
def _load_cache():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'x_cache.json')
    if not os.path.exists(p):
        return {}
    try:
        return json.load(open(p, encoding='utf-8')).get('posts') or {}
    except Exception:
        return {}
XCACHE = _load_cache()
HEAT_NOTE = '''<div class="heat-how"><div class="heat-head"><b>热度怎么算</b><button type="button" class="xmore heat-toggle" aria-expanded="false">展开</button></div><p class="heat-brief">热度榜按 heat_log 里该话题最近完整 UTC 日的 X 发帖量排序；卡片「浏览」是另一套链接浏览量。</p><div class="heat-full"><p>首页热度榜的数字是 heat_log.csv 里 x_daily_post_count 的最近一个完整 UTC 日发帖量，从高到低取前 10，不是加权分。折线按日排列，partial 未完成日不参与排名。卡片「浏览」是该条链接浏览量的最大值；≥10 万为爆，≥1 万为热。下面这张图是本条事件自己的 X 检索式逐日发帖量，星号是不完整时段。</p></div></div>'''
HEAD_JS = r'''<script>try{var q=new URLSearchParams(location.search).get("ui");var ui=(q==="classic"||q==="new")?q:localStorage.getItem("gossipUi");if(ui!=="classic"&&ui!=="new")ui="new";if(q==="classic"||q==="new"){try{localStorage.setItem("gossipUi",q)}catch(e){}}document.documentElement.dataset.ui=ui;var t=(location.hash.match(/theme=(\w+)/)||[])[1]||localStorage.getItem("gossipTheme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>'''
FOOT_JS = r'''<script src="../src/post_ui.js"></script><script>(function(){var KEY="gossipTz";function getTz(){try{var v=localStorage.getItem(KEY);if(v==="utc"||v==="cst")return v}catch(e){}return "cst"}function pad(n){return String(n).padStart(2,"0")}function fmt(iso,tz){var d=new Date(iso);if(isNaN(d))return null;var zone=tz==="utc"?"UTC":"Asia/Shanghai";try{var parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);var g=function(t){return parts.find(function(p){return p.type===t}).value};return g("year")+"-"+g("month")+"-"+g("day")+" "+g("hour")+":"+g("minute")+(tz==="utc"?" UTC":"")}catch(e){var x=tz==="utc"?d:new Date(d.getTime()+8*3600000);return x.getUTCFullYear()+"-"+pad(x.getUTCMonth()+1)+"-"+pad(x.getUTCDate())+" "+pad(x.getUTCHours())+":"+pad(x.getUTCMinutes())+(tz==="utc"?" UTC":"")}}function applyTz(){var tz=getTz();document.querySelectorAll("time[datetime]").forEach(function(el){var f=fmt(el.getAttribute("datetime"),tz);if(f)el.textContent=f});document.querySelectorAll("#tz [data-tz]").forEach(function(b){var on=b.getAttribute("data-tz")===tz;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")})}function applyUi(){var ui=document.documentElement.dataset.ui==="classic"?"classic":"new";var btn=document.querySelector("[data-ui-set]");if(btn){var next=ui==="new"?"classic":"new";btn.setAttribute("data-ui-set",next);btn.textContent=ui==="new"?"经典版":"新版"}var back=document.querySelector("a.back");if(back)back.href="../index.html?ui="+ui}function setUi(mode){if(mode!=="classic"&&mode!=="new")return;document.documentElement.dataset.ui=mode;try{localStorage.setItem("gossipUi",mode)}catch(e){}var u=new URL(location.href);u.searchParams.set("ui",mode);history.replaceState(null,"",u.pathname+u.search+u.hash);applyUi()}document.addEventListener("click",function(e){var ui=e.target.closest&&e.target.closest("[data-ui-set]");if(ui){setUi(ui.getAttribute("data-ui-set"));return}var b=e.target.closest&&e.target.closest("#tz button[data-tz]");if(!b)return;try{localStorage.setItem(KEY,b.getAttribute("data-tz"))}catch(_){}applyTz()});if(window.PostUI){PostUI.bind(document);PostUI.wireClamps(document)}applyTz();applyUi()})();</script>'''
def render(it, ed, all_items, out_dir):
    load_bits(all_items)
    bits = _BITS.get(it['id']) or {'orig': '', 'heat': '', 'timeline': []}
    d = it.get('detail') or {}
    name = tracker_name()
    company = display_label(it.get('company'), name)
    section = display_label(it.get('section'), name)
    title = display_label(d.get('title'), name) if d.get('title') else (company + '：' + it['text'][:30] + '…')
    tagc = 'b-real' if it.get('tag') == '实锤' else 'b-rum'
    P = []
    P.append(f'<div class="topbar"><a class="back" href="../index.html">← 返回看板</a><div class="tz" id="tz" role="group" aria-label="显示时区"><button type="button" data-tz="cst" class="on" aria-pressed="true">北京时间</button><button type="button" data-tz="utc" aria-pressed="false">UTC</button></div><button type="button" class="ui-toggle" data-ui-set="classic">经典版</button><span class="crumb">{E(TYPES.get(ed.get("type"), ed.get("type")))} · {html_with_times(ed.get("edition_date") or ed.get("timestamp"))} · {E(section)}</span></div>')
    P.append(f'<h1>{E(title)}</h1><div class="meta"><span class="pill">{E(company)}</span><span class="badge {tagc}">【{E(it.get("tag"))}】</span>' + ''.join(f'<span class="src">{E(s)}</span>' for s in it.get('source_types', [])) + f'<span class="note">📅 {html_with_times(it.get("date"))}</span>' + (f'<span class="note">· 深度资料整理于 {html_with_times(d.get("enriched_at"))}</span>' if d.get('enriched_at') else '') + (bits.get('heat') or '') + '</div>')
    P.append(f'<div class="summary">{E(d.get("summary") or it["text"])}</div>')
    P.append('<section><h2>原文</h2>' + (bits.get('orig') or '<p class="xmiss">原文未缓存</p>') + '</section>')
    P.append('<section><h2>📖 事件经过</h2>' + (f'<p>{E(d["background"])}</p>' if d.get('background') else f'<p>{E(it["text"])}</p><p class="na">暂无更详细的事件经过</p>') + '</section>')
    tl = bits.get('timeline') or []
    if tl:
        rows = []
        for t in tl:
            extra = t.get('orig') or (link(t.get('url'), '↗') if t.get('url') else '')
            rows.append(f'<div class="tli"><span class="d">{html_with_times(t.get("date"))}</span>{E(t.get("text"))} {extra}</div>')
        tl_html = '<p class="note">最新在上</p><div class="tl">' + ''.join(rows) + '</div>'
    else:
        tl_html = NA
    P.append('<section><h2>🕒 进展时间线</h2>' + tl_html + '</section>')
    H = []
    for p in d.get('x_posts') or []:
        H.append(f'<div class="post"><span class="note">数据抓取 {html_with_times(p.get("fetched_at"))}</span>{hbars(p)} {link(p.get("url"), "原链接（站外）")}</div>')
    if not H:
        lv = [l for l in it.get('links', []) if l.get('views')]
        if lv: H.append('<div class="note">简报收录时的浏览量：</div><ul>' + ''.join(f'<li>{link(l["url"], l["label"])} · 👁 {E(l["views"])}</li>' for l in lv) + '</ul>')
    tr = d.get('x_trend')
    if tr:
        anchor = parse_dt(tr.get('fetched_at'))
        vals = tr.get('values') or []
        delta = ''
        if len(vals) >= 2:
            dlt = vals[-1] - vals[-2]
            delta = f'<p class="note">最近 {fmt(vals[-1])}，较前一点 {"+" if dlt>0 else ""}{fmt(dlt)}</p>'
        H.append(f'<h3 style="font-size:15px;margin:14px 0 4px">X 每日发帖量</h3><div class="note">检索式：{E(tr.get("query"))} · {html_with_times(tr.get("source"), anchor)} · 抓取 {html_with_times(tr.get("fetched_at"))} · {html_with_times(tr.get("note",""), anchor)}</div>' + bar_chart(tr.get('labels', []), vals) + delta + HEAT_NOTE)
    wb = d.get('weibo')
    H.append('<h3 style="font-size:15px;margin:14px 0 4px">微博热搜</h3>' + (f'<p>{("排名：第 " + E(wb["rank"]) + " 位 · ") if wb.get("rank") else ""}{E(wb.get("text"))} {link(wb.get("url"), "来源↗")}</p>' if wb else NA))
    op = d.get('other_platforms') or []
    H.append('<h3 style="font-size:15px;margin:14px 0 4px">其他平台</h3>' + ('<div class="kv">' + ''.join(f'<div><span class="note">{E(o.get("platform"))} · {E(o.get("metric"))}</span><br><b>{E(o.get("value"))}</b> {link(o.get("url"), "↗")}</div>' for o in op) + '</div>' if op else NA))
    P.append('<section><h2>📊 各平台热度</h2>' + ''.join(H) + '</section>')
    cm = d.get('comments') or []
    P.append('<section><h2>💬 典型评论</h2>' + (''.join(f'<div class="cmt"><span class="st st-{E(c.get("stance"))}">{E(c.get("stance"))}</span><q>{E(c.get("text"))}</q><div class="by">— {E(c.get("author"))} · {E(c.get("platform"))} · {link(c.get("url"), "原文↗")}</div></div>' for c in cm) + (f'<p class="note">{E(d.get("stance_note"))}</p>' if d.get('stance_note') else '') if cm else NA) + '</section>')
    rs = d.get('responses') or []
    P.append('<section><h2>📢 各方回应</h2>' + (''.join(f'<div class="resp"><b>{E(r.get("party"))}</b>{E(r.get("text"))} {link(r.get("url"), "来源↗")}</div>' for r in rs) if rs else NA) + '</section>')
    rel = []
    for name in d.get('related') or []:
        for o in all_items:
            if o is not it and o['company'] == name and o['id'] not in [x['id'] for x in rel]: rel.append(o)
    for o in all_items:  # same section neighbours if nothing explicit
        if not d.get('related') and o is not it and o.get('section') == it.get('section') and o.get('_file') == it.get('_file'): rel.append(o)
    P.append('<section><h2>🔗 相关事件</h2>' + ('<ul>' + ''.join(f'<li><a href="{E(o["id"])}.html">{E(display_label(o["company"], name))}</a>：{E(o["text"][:50])}…</li>' for o in rel[:6]) + '</ul>' if rel else NA) + '</section>')
    srcs = [(l.get('label'), l.get('url'), l.get('views')) for l in it.get('links', [])] + [(x.get('label'), x.get('url'), None) for x in d.get('extra_sources', [])]
    P.append('<section><h2>📚 所有来源链接</h2>' + ('<ul>' + ''.join(f'<li>{link(u, l)}{(" · 👁 " + E(v)) if v else ""} <span class="note">{E(u)}</span></li>' for l, u, v in srcs) + '</ul>' if srcs else NA) + '</section>')
    P.append('<p class="note" style="margin-top:20px">本页仅展示数据文件中已有的信息；【传闻】为单方面说法，未经核实。缺失字段显示“暂无数据”。</p>')
    doc = f'''<!DOCTYPE html><html lang="zh-CN" data-theme="dark" data-ui="new"><head>{HEAD_JS}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{E(title)}</title>
<link rel="stylesheet" href="../src/post.css"><style>{CSS}</style></head><body><div class="wrap">{"".join(P)}</div>{FOOT_JS}</body></html>'''
    open(os.path.join(out_dir, it['id'] + '.html'), 'w', encoding='utf-8').write(doc)
