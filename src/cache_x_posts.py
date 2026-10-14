#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cache X/Twitter post text for static GitHub Pages.

Reads status URLs already cited in data/*.json, fetches a public snapshot from
api.fxtwitter.com, and writes src/x_cache.json. Also fills optional `text` and
`author_name` on existing detail.x_posts objects when those fields are absent.
Does not overwrite views/likes/reposts already stored in the JSON.

Usage (from anywhere):
    python3 src/cache_x_posts.py

Re-run before `build_dashboard.py` when you want fresher bodies. Failed fetches
are stored with status "missing" and no invented text; the UI shows 「原文未缓存」.
"""
import json, os, re, time, datetime, urllib.request, urllib.error
BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
OUT = os.path.join(BASE, 'x_cache.json')
STATUS = re.compile(r'(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([^/]+)/status/(\d+)', re.I)

def walk_urls(o, found):
    if isinstance(o, dict):
        u = o.get('url')
        if isinstance(u, str):
            m = STATUS.search(u)
            if m:
                found[m.group(2)] = f'https://x.com/{m.group(1)}/status/{m.group(2)}'
        for v in o.values():
            walk_urls(v, found)
    elif isinstance(o, list):
        for v in o:
            walk_urls(v, found)

def iso_from_fx(s):
    if not s:
        return None
    try:
        dt = datetime.datetime.strptime(s, '%a %b %d %H:%M:%S %z %Y')
    except ValueError:
        return None
    return dt.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def fetch(sid):
    url = f'https://api.fxtwitter.com/status/{sid}'
    req = urllib.request.Request(url, headers={'User-Agent': 'gossip-dashboard-cache/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=25) as r:
        payload = json.load(r)
    tw = (payload or {}).get('tweet') or {}
    text = (tw.get('text') or '').strip()
    author = tw.get('author') or {}
    handle = author.get('screen_name') or ''
    if not text:
        return {'status': 'missing', 'error': 'empty text'}
    return {
        'status': 'ok',
        'text': text,
        'author': ('@' + handle) if handle and not str(handle).startswith('@') else handle,
        'name': author.get('name') or '',
        'created_at': iso_from_fx(tw.get('created_at')),
        'views': tw.get('views'),
        'likes': tw.get('likes'),
        'reposts': tw.get('retweets'),
        'replies': tw.get('replies'),
        'quotes': tw.get('quotes'),
        'bookmarks': tw.get('bookmarks'),
        'url': tw.get('url') or f'https://x.com/i/status/{sid}',
    }

def main():
    found = {}
    files = []
    for fn in sorted(os.listdir(DATA)):
        if not fn.endswith('.json'):
            continue
        path = os.path.join(DATA, fn)
        files.append(path)
        walk_urls(json.load(open(path, encoding='utf-8')), found)
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    posts = {}
    ids = sorted(found)
    print('statuses', len(ids))
    for i, sid in enumerate(ids, 1):
        try:
            snap = fetch(sid)
        except Exception as e:
            snap = {'status': 'missing', 'error': str(e)[:180]}
        snap['fetched_at'] = now
        snap.setdefault('url', found[sid])
        posts[sid] = snap
        print(f'{i}/{len(ids)}', sid, snap.get('status'), (snap.get("text") or snap.get("error") or "")[:40].replace("\n", " "))
        time.sleep(0.2)
    doc = {
        'source': 'https://api.fxtwitter.com/status/{id}',
        'fetched_at': now,
        'note': '静态缓存。正文只来自抓取结果；失败项 status=missing，页面显示「原文未缓存」。不覆盖 data JSON 里已有的浏览/点赞数字。',
        'posts': posts,
    }
    json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    filled = 0
    for path in files:
        data = json.load(open(path, encoding='utf-8'))
        changed = False
        def patch(o):
            nonlocal changed, filled
            if isinstance(o, dict):
                posts_ = o.get('x_posts')
                if isinstance(posts_, list):
                    for p in posts_:
                        m = STATUS.search(str(p.get('url') or ''))
                        if not m:
                            continue
                        snap = posts.get(m.group(2)) or {}
                        if snap.get('status') == 'ok' and snap.get('text') and not p.get('text'):
                            p['text'] = snap['text']
                            if snap.get('name') and not p.get('author_name'):
                                p['author_name'] = snap['name']
                            filled += 1
                            changed = True
                for v in o.values():
                    patch(v)
            elif isinstance(o, list):
                for v in o:
                    patch(v)
        patch(data)
        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
                f.write('\n')
    print('filled x_posts text', filled)

def fill_missing():
    """Fetch only status ids cited in data that are absent or have no text.

    Existing ok entries are left untouched. A failed fetch is stored as
    status=missing with no invented text.
    """
    found = {}
    if not os.path.isdir(DATA):
        return
    for fn in sorted(os.listdir(DATA)):
        if not fn.endswith('.json'):
            continue
        walk_urls(json.load(open(os.path.join(DATA, fn), encoding='utf-8')), found)
    posts = {}
    doc = {}
    if os.path.exists(OUT):
        try:
            doc = json.load(open(OUT, encoding='utf-8'))
            posts = doc.get('posts') or {}
        except Exception:
            posts = {}
    missing = [sid for sid in sorted(found) if not (posts.get(sid) or {}).get('text')]
    print('x cache', len(found), 'missing', len(missing))
    if not missing:
        return
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    for i, sid in enumerate(missing, 1):
        try:
            snap = fetch(sid)
        except Exception as e:
            snap = {'status': 'missing', 'error': str(e)[:180]}
        snap['fetched_at'] = now
        snap.setdefault('url', found[sid])
        posts[sid] = snap
        print(f'fetch {i}/{len(missing)}', sid, snap.get('status'), (snap.get('text') or snap.get('error') or '')[:40].replace('\n', ' '))
        time.sleep(0.2)
    out = {
        'source': doc.get('source') or 'https://api.fxtwitter.com/status/{id}',
        'fetched_at': now,
        'note': '静态缓存。正文只来自抓取结果；失败项 status=missing，页面显示「原文未缓存」。不覆盖 data JSON 里已有的浏览/点赞数字。',
        'posts': posts,
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('x cache updated', len(posts))

if __name__ == '__main__':
    main()
