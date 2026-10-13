# -*- coding: utf-8 -*-
"""Render dashboard/events/<id>.html for every item (used by build_dashboard.py)."""
import html, json, os, re
E = lambda s: html.escape(str(s if s is not None else ''), quote=True)
NA = '<p class="na">暂无数据</p>'
TYPES = {'bigtech': '大厂八卦', 'adr': '美股中概&出海', 'alert': '快讯', 'daily': '每日总结'}
def fmt(n):
    if n is None: return '—'
    n = float(n)
    return (f'{n/1e4:.1f}万' if n >= 1e4 else f'{int(n):,}')
def link(url, label=None):
    return f'<a href="{E(url)}" target="_blank" rel="noopener">{E(label or url)}</a>' if url else ''
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
a{color:var(--acc2)}.wrap{max-width:920px;margin:0 auto;padding:0 20px 50px}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 0;font-size:13px;color:var(--mut)}
h1{font-size:28px;line-height:1.35;margin:6px 0 10px}
.meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.pill{background:var(--acc);color:#fff;border-radius:999px;padding:1px 12px;font-weight:700}
.badge{border-radius:6px;padding:0 7px;font-size:12.5px;font-weight:700}.b-real{color:var(--ok);border:1px solid var(--ok)}.b-rum{color:var(--rumor);border:1px solid var(--rumor)}
.src{font-size:12px;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:0 6px}
.summary{background:var(--card);border-left:4px solid var(--acc);padding:14px 18px;border-radius:0 10px 10px 0;font-size:16px}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-top:18px}
section h2{margin:0 0 10px;font-size:18px}.na{color:var(--mut);font-style:italic;margin:0}.note{font-size:12px;color:var(--mut)}
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
'''
def render(it, ed, all_items, out_dir):
    d = it.get('detail') or {}
    title = d.get('title') or (it['company'] + '：' + it['text'][:30] + '…')
    tagc = 'b-real' if it.get('tag') == '实锤' else 'b-rum'
    P = []
    P.append(f'<div class="topbar"><a href="../index.html">← 返回看板</a><span>{E(TYPES.get(ed.get("type"), ed.get("type")))} · {E(ed.get("edition_date") or ed.get("timestamp"))} · {E(it.get("section"))}</span></div>')
    P.append(f'<h1>{E(title)}</h1><div class="meta"><span class="pill">{E(it["company"])}</span><span class="badge {tagc}">【{E(it.get("tag"))}】</span>' + ''.join(f'<span class="src">{E(s)}</span>' for s in it.get('source_types', [])) + f'<span class="note">📅 {E(it.get("date"))}</span>' + (f'<span class="note">· 深度资料整理于 {E(d.get("enriched_at"))}</span>' if d.get('enriched_at') else '') + '</div>')
    P.append(f'<div class="summary">{E(d.get("summary") or it["text"])}</div>')
    P.append('<section><h2>📖 事件经过</h2>' + (f'<p>{E(d["background"])}</p>' if d.get('background') else f'<p>{E(it["text"])}</p><p class="na">暂无更详细的事件经过</p>') + '</section>')
    tl = d.get('timeline') or []
    P.append('<section><h2>🕒 进展时间线</h2>' + ('<div class="tl">' + ''.join(f'<div class="tli"><span class="d">{E(t.get("date"))}</span>{E(t.get("text"))} {link(t.get("url"), "↗")}</div>' for t in tl) + '</div>' if tl else NA) + '</section>')
    # heat
    H = []
    for p in d.get('x_posts') or []:
        H.append(f'<div class="post"><b>{link(p.get("url"), "X " + p.get("author", ""))}</b> <span class="note">发布 {E(p.get("created_at"))} · 数据抓取 {E(p.get("fetched_at"))}</span>{hbars(p)}</div>')
    if not H:  # fall back to view counts listed on links
        lv = [l for l in it.get('links', []) if l.get('views')]
        if lv: H.append('<div class="note">简报收录时的浏览量：</div><ul>' + ''.join(f'<li>{link(l["url"], l["label"])} · 👁 {E(l["views"])}</li>' for l in lv) + '</ul>')
    tr = d.get('x_trend')
    if tr: H.append(f'<h3 style="font-size:15px;margin:14px 0 4px">X 每日发帖量</h3><div class="note">检索式：{E(tr.get("query"))} · {E(tr.get("source"))} · 抓取 {E(tr.get("fetched_at"))} · {E(tr.get("note",""))}</div>' + bar_chart(tr.get('labels', []), tr.get('values', [])))
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
    P.append('<section><h2>🔗 相关事件</h2>' + ('<ul>' + ''.join(f'<li><a href="{E(o["id"])}.html">{E(o["company"])}</a>：{E(o["text"][:50])}…</li>' for o in rel[:6]) + '</ul>' if rel else NA) + '</section>')
    srcs = [(l.get('label'), l.get('url'), l.get('views')) for l in it.get('links', [])] + [(x.get('label'), x.get('url'), None) for x in d.get('extra_sources', [])]
    P.append('<section><h2>📚 所有来源链接</h2>' + ('<ul>' + ''.join(f'<li>{link(u, l)}{(" · 👁 " + E(v)) if v else ""} <span class="note">{E(u)}</span></li>' for l, u, v in srcs) + '</ul>' if srcs else NA) + '</section>')
    P.append('<p class="note" style="margin-top:20px">本页仅展示数据文件中已有的信息；【传闻】为单方面说法，未经核实。缺失字段显示“暂无数据”。</p>')
    doc = f'''<!DOCTYPE html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{E(title)}</title>
<script>try{{var t=(location.hash.match(/theme=(\\w+)/)||[])[1]||localStorage.getItem("gossipTheme");if(t)document.documentElement.dataset.theme=t}}catch(e){{}}</script><style>{CSS}</style></head><body><div class="wrap">{"".join(P)}</div></body></html>'''
    open(os.path.join(out_dir, it['id'] + '.html'), 'w', encoding='utf-8').write(doc)
