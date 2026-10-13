#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build dashboard/index.html from data/*.json + topics.md + heat_log.csv. Usage: python3 build_dashboard.py"""
import json, glob, os, re, csv, datetime, html
BASE = os.path.dirname(os.path.abspath(__file__))
import sys; sys.path.insert(0, BASE)
def load_editions():
    eds = []
    for f in sorted(glob.glob(os.path.join(BASE, 'data', '*.json'))):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            print('skip', f, e); continue
        d['_file'] = os.path.basename(f)
        d.setdefault('sections', [])
        stem = os.path.splitext(d['_file'])[0]
        for si, s in enumerate(d['sections']):
            for ii, it in enumerate(s.get('items', [])):
                it.setdefault('section', s.get('title', ''))
                it.setdefault('id', f'{stem}-{si}-{ii}')
                it['id'] = re.sub(r'[^A-Za-z0-9_.-]', '-', str(it['id']))
        eds.append(d)
    eds.sort(key=lambda d: (str(d.get('timestamp', '')), {'daily':3,'bigtech':2,'adr':1}.get(d.get('type'),0)), reverse=True)
    return eds
def load_topics():
    p = os.path.join(BASE, 'topics.md'); lt, st = [], []
    if not os.path.exists(p): return lt, st
    mode = None
    for line in open(p, encoding='utf-8'):
        if line.startswith('## '):
            mode = 'long' if '长期' in line else 'short' if '短期' in line else None; continue
        m = re.match(r'\s*\d+\.\s*(.+)', line)
        if mode == 'long' and m:
            full = m.group(1).strip()
            name = re.split(r'[（(]', full)[0].strip()
            inner = re.search(r'[（(](.*)[）)]', full)
            kws = [k for k in re.split(r'[&、/，,\s]+|相关', name) if len(k) >= 2]
            if inner: kws += [k.strip() for k in re.split(r'[、,，/]', inner.group(1)) if 1 < len(k.strip()) <= 12 and '等' != k.strip()[-1:] or k.strip().rstrip('等') and len(k.strip())<=12]
            kws = [k.rstrip('等').strip() for k in kws]
            kws = sorted({k for k in kws if len(k) >= 2})
            lt.append(dict(name=name, desc=full, keywords=kws))
        if mode == 'short' and line.strip().startswith('- ') and '|' in line:
            parts = [x.strip() for x in line.strip()[2:].split('|')]
            if len(parts) >= 5 and parts[0] != '话题名':
                st.append(dict(name=parts[0], added=parts[1], reason=parts[2], heat=parts[3], status=parts[4]))
    return lt, st
def load_heat():
    p = os.path.join(BASE, 'heat_log.csv'); rows = []
    if os.path.exists(p):
        for r in csv.DictReader(open(p, encoding='utf-8')):
            try: r['value'] = float(str(r.get('value', '')).replace(',', ''))
            except ValueError: continue
            rows.append(r)
    return rows
def main():
    eds = load_editions(); lt, st = load_topics(); heat = load_heat()
    # topic aliases for long-term keyword matching (only extend matching, never data)
    alias = {'字节': ['字节跳动', '字节', 'ByteDance', 'TikTok', '抖音', '豆包', '飞书', 'Seed'],
             '滴滴': ['滴滴', 'DiDi', 'Didi', '99'], '大模型': ['大模型', 'DeepSeek', '月之暗面', 'Kimi', '智谱', 'MiniMax', '阶跃', '百川', '通义', '千问', '文心', '混元', 'MiMo', 'Moonshot', 'Qwen']}
    for t in lt:
        for k, v in alias.items():
            if k in t['name']: t['keywords'] = sorted(set(t['keywords']) | set(v) - {'99'} | ({'99'} if k=='滴滴' else set()))
    noise = ('业务', '八卦', '组织', '人事', '助理', '拉美', '巴西', '墨西哥', '澳洲', '香港')
    for t in lt:
        ks = set()
        for k in t['keywords']:
            ks |= set(k.split())
        t['keywords'] = sorted(k for k in ks if len(k) >= 2 and k != '99' and not any(n in k for n in noise))
    payload = dict(editions=eds, longterm=lt, shortterm=st, heat=heat,
                   built=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))
    tpl = open(os.path.join(BASE, 'dashboard_template.html'), encoding='utf-8').read()
    js = json.dumps(payload, ensure_ascii=False).replace('</', '<\\/')
    os.makedirs(os.path.join(BASE, 'dashboard'), exist_ok=True)
    out = os.path.join(BASE, 'dashboard', 'index.html')
    open(out, 'w', encoding='utf-8').write(tpl.replace('/*__DATA__*/null', js))
    import detail_render, shutil
    ev = os.path.join(BASE, 'dashboard', 'events'); shutil.rmtree(ev, ignore_errors=True); os.makedirs(ev)
    allit = []
    for e in eds:
        for sct in e['sections']:
            for it in sct.get('items', []): it['_file'] = e['_file']; it['_ed'] = e; allit.append(it)
    for it in allit: detail_render.render(it, it['_ed'], allit, ev)
    for it in allit: it.pop('_ed', None); it.pop('_file', None)
    print('detail pages:', len(allit), '(enriched:', sum(1 for i in allit if i.get('detail')), ')')
    print('wrote', out, '| editions:', len(eds), '| heat rows:', len(heat))
if __name__ == '__main__': main()
