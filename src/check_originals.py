#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fail if a built event page drops the original-text block or 展开 on long text.

Run after build_dashboard.py, from the repo root:

    python3 src/check_originals.py
"""
import json, os, re, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
sys.path.insert(0, SRC)
import build_dashboard

FOLD = 72
VISIBLE_EXPAND = re.compile(r'<button type="button" class="xmore" aria-expanded="false">展开</button>')
ORIG_BLOCK = re.compile(r'<blockquote class="orig\b.*?</blockquote>', re.S)

def esc(s):
    return (str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))

def fail(errors, msg):
    errors.append(msg)

def orig_blocks(page):
    return ORIG_BLOCK.findall(page)

def node_report(items, posts):
    code = r'''
const UI = require('./src/post_ui.js');
let raw = '';
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const fails = [];
  const en = 'This English post is deliberately long enough that the fold control must stay visible for the original underneath the Chinese translation.';
  const trHtml = UI.origBlock({url:'https://x.com/a/status/9', text:en, lang:'en', translation_zh:'这是中文译文，应当排在原文前面。', author:'@a'}, {clamp:true});
  if (trHtml.indexOf('这是中文译文') < 0 || trHtml.indexOf('这是中文译文') > trHtml.indexOf('This English post')) fails.push('translation should render before the original');
  if (!trHtml.includes('英文')) fails.push('missing language tag');
  if (!trHtml.includes('data-orig="1"')) fails.push('translation block missing data-orig');
  if (!trHtml.includes('class="plogo"')) fails.push('x post missing logo');
  if (!VISIBLE(trHtml)) fails.push('translated long post missing 展开');
  const miss = UI.origBlock({url:'https://news.example.com/a', text:''}, {clamp:true});
  if (!miss.includes('原文未缓存') || !miss.includes('https://news.example.com/a') || !miss.includes('data-miss="1"')) fails.push('missing cache should say 原文未缓存 and keep the link');
  const shortZh = UI.origBlock({url:'https://x.com/a/status/1', text:'短', lang:'zh'}, {clamp:true});
  if (!shortZh.includes('hidden') || shortZh.includes('原文未缓存')) fails.push('short Chinese post should keep a hidden 展开 and not say 原文未缓存');
  const item = {id:'t', company:'C', text:'editorial blurb that must not replace the post', lang:'ja', translation_zh:'日文帖的中文译文，长度足够单独成句。', links:[{url:'https://x.com/a/status/3', label:'X'}]};
  const primary = UI.primaryOf(item, {'3': {status:'ok', text:en, author:'@a'}});
  if (primary.text !== en) fails.push('primary text must come from the cache, not the editorial blurb');
  if (primary.lang !== 'ja' || !primary.translation_zh) fails.push('item translation_zh/lang should attach to the post');
  const itemHtml = UI.origBlock(primary, {clamp:true});
  if (itemHtml.indexOf('日文帖的中文译文') > itemHtml.indexOf('This English post')) fails.push('item-level translation should stay above the original');
  if (!itemHtml.includes('日文')) fails.push('ja tag should read 日文');
  const posts = input.posts || {};
  const report = {};
  (input.items || []).forEach(it => {
    report[it.id] = UI.sourcesOf(it, posts).map(s => ({
      snippet: (s.text || '').slice(0, 24),
      tr: (s.translation_zh || '').slice(0, 24),
      textLen: UI.plainLen(s.text || ''),
      trLen: UI.plainLen(s.translation_zh || ''),
      url: s.url || '',
      miss: !String(s.text || '').trim() && !(s.translation_zh && s.lang && !/^zh/i.test(s.lang))
    }));
  });
  process.stdout.write(JSON.stringify({fails, report}));
  function VISIBLE(html) {
    return /<button type="button" class="xmore" aria-expanded="false">展开<\/button>/.test(html);
  }
});
'''
    # VISIBLE is used before its function declaration; function declarations are hoisted in the callback? 
    # The callback is an arrow? It's a function() so function VISIBLE inside it is hoisted. Good.
    proc = subprocess.run(['node', '-e', code], input=json.dumps({'items': items, 'posts': posts}, ensure_ascii=False).encode('utf-8'), cwd=ROOT, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.decode('utf-8', 'replace')[:2000] or 'node audit failed')
    return json.loads(proc.stdout.decode('utf-8'))

def main():
    errors = []
    for rel in ('src/board_ui.js', 'src/detail_render.py', 'src/post_ui.js', 'src/dashboard_template.html'):
        text = open(os.path.join(ROOT, rel), encoding='utf-8').read()
        if '正文未缓存' in text:
            fail(errors, rel + ' still says 正文未缓存')
        if rel != 'src/post_ui.js' and 'M18.244' in text:
            fail(errors, rel + ' still duplicates the X logo path')
    board = open(os.path.join(SRC, 'board_ui.js'), encoding='utf-8').read()
    for name in ('leadCompact', 'eventCard', 'leadCard', 'storyBlock', 'mcard', 'renderHero', 'paperDetail', 'detailHTML'):
        m = re.search(r'function %s\b' % name, board)
        if not m:
            fail(errors, 'board missing ' + name)
            continue
        chunk = board[m.start():m.start() + 2200]
        if 'itemOrig' not in chunk and 'allOrig' not in chunk:
            fail(errors, name + ' does not render the shared original block')
    index = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if 'src/post_ui.js' not in index or index.find('src/post_ui.js') > index.find('src/board_ui.js'):
        fail(errors, 'index.html must load post_ui.js before board_ui.js')
    if 'src/post.css' not in index:
        fail(errors, 'index.html missing post.css')
    if '以前我的合伙人就是百度' not in index:
        fail(errors, 'index payload is missing the cached Baidu post')
    eds = build_dashboard.load_editions()
    items = []
    for e in eds:
        for sct in e.get('sections') or []:
            items.extend(sct.get('items') or [])
    cache_path = os.path.join(SRC, 'x_cache.json')
    posts = json.load(open(cache_path, encoding='utf-8')).get('posts') or {}
    slim = [{k: v for k, v in it.items() if not str(k).startswith('_')} for it in items]
    audited = node_report(slim, posts)
    for msg in audited.get('fails') or []:
        fail(errors, 'module: ' + msg)
    report = audited.get('report') or {}
    pages = 0
    long_ok = 0
    miss_ok = 0
    for it in items:
        path = os.path.join(ROOT, 'events', it['id'] + '.html')
        if not os.path.exists(path):
            fail(errors, 'missing page ' + it['id'])
            continue
        page = open(path, encoding='utf-8').read()
        pages += 1
        if 'data-ui="new"' not in page or 'gossipUi' not in page or '北京时间' not in page:
            fail(errors, it['id'] + ' detail page lost ui/tz toggle')
        if '../src/post_ui.js' not in page:
            fail(errors, it['id'] + ' does not load the shared module')
        blocks = orig_blocks(page)
        if not blocks:
            fail(errors, it['id'] + ' has no original-text block')
            continue
        for b in blocks:
            lm = re.search(r'data-len="(\d+)"', b)
            fm = re.search(r'data-fold="(\d+)"', b)
            if not lm or not fm:
                fail(errors, it['id'] + ' orig block missing data-len/data-fold')
                continue
            if int(lm.group(1)) > int(fm.group(1)) or 'data-tr="1"' in b:
                if not VISIBLE_EXPAND.search(b):
                    fail(errors, it['id'] + ' long or translated original is missing 展开')
                else:
                    long_ok += 1
        sources = report.get(it['id']) or []
        if not sources:
            fail(errors, it['id'] + ' has no source record')
            continue
        for src in sources:
            if src.get('snippet'):
                sn = esc(src['snippet'])
                hit = [b for b in blocks if sn in b]
                if not hit:
                    fail(errors, it['id'] + ' orig block is missing cached text: ' + src['snippet'][:18])
                    continue
                if 'x.com/' in src['url'] or 'twitter.com/' in src['url']:
                    if not any('class="plogo"' in b for b in hit):
                        fail(errors, it['id'] + ' X original is missing the platform logo')
                if src.get('textLen', 0) > FOLD or src.get('trLen', 0) > FOLD:
                    if not any(VISIBLE_EXPAND.search(b) for b in hit):
                        fail(errors, it['id'] + ' long text has no 展开')
            elif src.get('miss'):
                if '原文未缓存' not in page:
                    fail(errors, it['id'] + ' has no cached text but does not say 原文未缓存')
                elif src.get('url') and esc(src['url']) not in page:
                    fail(errors, it['id'] + ' 原文未缓存 is missing the link')
                else:
                    miss_ok += 1
            if src.get('tr') and esc(src['tr']) not in page:
                fail(errors, it['id'] + ' is missing translation_zh')
        if '百度' in (it.get('company') or '') and 'M3' in (it.get('text') or ''):
            if '以前我的合伙人就是百度' not in page or '原文未缓存' in page:
                fail(errors, 'Baidu detail page does not show the cached post')
            if 'data-ui-set' not in page:
                fail(errors, 'Baidu detail page has no ui toggle')
    print('checked pages', pages, 'long-or-translated blocks', long_ok, 'explicit misses', miss_ok)
    if errors:
        print('FAIL', len(errors))
        for e in errors:
            print('-', e)
        return 1
    print('OK')
    return 0

if __name__ == '__main__':
    sys.exit(main())
