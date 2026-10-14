#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Content gate for every board entry. Rules: see ../CONTENT_RULES.md.

    python3 src/check_content.py        # exit 1 and list problems on violation

An entry may carry `pending: ["待补充：原因", ...]` for a field that truly cannot be filled;
a pending note naming the field counts as satisfying it (honest gap > invented content).
"""
import json, glob, os, re, sys, subprocess

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
TAGS = {'实锤', '传闻', '待核实', '官方', '统计'}
XRE = re.compile(r'https?://(?:www\.)?(?:x|twitter)\.com/[A-Za-z0-9_]+/status/(\d+)', re.I)
CJK = re.compile(r'[\u4e00-\u9fff]')
STUB = ('本期无新动态', '本期无重大新动态', '本期有新动态')


def pend(obj, field):
    return any(field in p and p.startswith('待补充') for p in obj.get('pending') or [])


def foreign(text):
    t = re.sub(r'https?://\S+|@\w+|#\w+', '', text or '')
    letters = re.findall(r'[A-Za-z\u00c0-\u024f\u0400-\u04ff]', t)
    return len(letters) >= 15 and len(CJK.findall(t)) < len(letters) * 0.2


def load_items():
    out = []
    for f in sorted(glob.glob(os.path.join(SRC, 'data', '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        for si, sc in enumerate(d.get('sections') or []):
            for ii, it in enumerate(sc.get('items') or []):
                out.append((os.path.basename(f), si, ii, it))
    return out


def check_item(it, xc):
    p = []
    text = (it.get('text') or '').strip()
    title = ((it.get('detail') or {}).get('title') or '').strip()
    if text.startswith(STUB):
        return p  # edition stub rows ("本期无新动态") are status lines, not board entries
    if not pend(it, '说明') and (len(text) < 15 or text == title or text == it.get('company')):
        p.append('事件说明不足（<15字或等于标题）')
    links = [l for l in it.get('links') or [] if (l.get('url') or '').startswith('http')]
    if not links and not pend(it, '来源'):
        p.append('缺来源链接')
    if it.get('tag') not in TAGS and not pend(it, '可信度'):
        p.append('缺可信度标注（tag）')
    if not (it.get('date') or '').strip() and not pend(it, '时间'):
        p.append('缺时间')
    lang = (it.get('lang') or '').lower()
    if lang and not lang.startswith('zh') and not pend(it, '译文'):
        if not it.get('translation_zh'): p.append('外语条目缺中文译文')
        if not it.get('original'): p.append('外语条目缺原文')
    for l in links:
        m = XRE.search(l['url'])
        if not m: continue
        c = xc.get(m.group(1))
        if not c and not pend(it, '缓存'):
            p.append('X 帖未缓存: ' + l['url'])
        elif c and c.get('status') == 'ok' and foreign(c.get('text')) and not (it.get('translation_zh') or c.get('translation_zh')) and not pend(it, '译文'):
            p.append('外语 X 帖缺中文译文: ' + l['url'])
    return p


def check_note(name, n):
    p = []
    if len((n.get('summary') or '').strip()) < 15 or n.get('summary', '').strip() == name: p.append('说明不足')
    if not [s for s in n.get('sources') or [] if (s.get('url') or '').startswith('http')] and not pend(n, '来源'): p.append('缺来源链接')
    if n.get('credibility') not in TAGS and not pend(n, '可信度'): p.append('缺可信度')
    if not n.get('recorded_at'): p.append('缺录入时间')
    return p


def unmatched_heat_topics(items):
    """Heat topics the board cannot route to an event page (same matcher as the UI)."""
    import csv
    heat = list(csv.DictReader(open(os.path.join(SRC, 'heat_log.csv'), encoding='utf-8')))
    for r in heat: r['value'] = float(r['value']) if re.match(r'^-?[\d.]+$', r['value'] or '') else 0
    cands = []
    for _, _, _, it in items:
        d = it.get('detail') or {}
        cands.append({'id': it.get('id') or '', 'title': d.get('title') or '', 'company': it.get('company') or '',
                      'blob': (it.get('company') or '') + ' ' + (d.get('title') or '') + ' ' + (it.get('text') or ''),
                      'rich': bool(d.get('title') or d.get('timeline'))})
    js = r'''const UI=require(process.argv[1]);let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const i=JSON.parse(s);
const names=[...new Set(i.heat.map(r=>r.topic))];console.log(JSON.stringify(names.filter(t=>!UI.matchTopic(t,i.cands))));});'''
    r = subprocess.run(['node', '-e', js, os.path.join(SRC, 'post_ui.js')], input=json.dumps({'heat': heat, 'cands': cands}),
                       capture_output=True, text=True, timeout=60)
    if r.returncode: raise SystemExit('node matcher failed: ' + r.stderr)
    return json.loads(r.stdout)


def main():
    xc = json.load(open(os.path.join(SRC, 'x_cache.json'), encoding='utf-8')).get('posts', {})
    np = os.path.join(SRC, 'topic_notes.json')
    notes = json.load(open(np, encoding='utf-8')).get('notes', {}) if os.path.exists(np) else {}
    items = load_items()
    problems = []
    for f, si, ii, it in items:
        for p in check_item(it, xc):
            problems.append(f'[事件] {f} §{si}#{ii} {it.get("id") or "(无id)"} {it.get("company")}: {p}')
    for t in unmatched_heat_topics(items):
        n = notes.get(t)
        if not n:
            problems.append(f'[热榜] {t}: 没有对应事件，也没有 topic_notes.json 说明')
            continue
        for p in check_note(t, n): problems.append(f'[热榜] {t}: {p}')
    for t, n in notes.items():
        for p in check_note(t, n): problems.append(f'[说明] {t}: {p}')
    pend_n = sum(1 for *_, it in items if it.get('pending')) + sum(1 for n in notes.values() if n.get('pending'))
    if problems:
        print('CONTENT CHECK FAILED: %d problem(s)' % len(problems))
        for p in sorted(set(problems)): print('  -', p)
        sys.exit(1)
    print('content check ok: %d items, %d topic notes, %d with 待补充' % (len(items), len(notes), pend_n))


if __name__ == '__main__':
    main()
