#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cache X/Twitter post text for static GitHub Pages.

Collects every status id cited in data/*.json or in heat_log.csv `source`,
fetches a public snapshot from api.fxtwitter.com, and writes src/x_cache.json.
Also fills optional `text` and `author_name` on existing detail.x_posts objects
when those fields are absent. Does not overwrite views/likes/reposts already
stored in the JSON, and does not invent post text.

A deleted or empty post is stored as status "unavailable" (UI: 「原文不可用」).
A network failure is status "missing" and is retried on the next build
(UI: 「原文未缓存」 until a snapshot exists).

Usage (from anywhere):
    python3 src/cache_x_posts.py
"""
import csv, json, os, re, time, datetime, urllib.request, urllib.error
BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
OUT = os.path.join(BASE, 'x_cache.json')
HEAT = os.path.join(BASE, 'heat_log.csv')
STATUS = re.compile(r'(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]+)/status/(\d+)', re.I)
NOTE = '静态缓存。正文只来自抓取结果。删帖或空正文 status=unavailable，页面显示「原文不可用」。网络失败 status=missing，下次构建重试，页面显示「原文未缓存」。不编正文，也不覆盖 data JSON 里已有的浏览/点赞数字。'

def add_status(found, text):
    if not isinstance(text, str):
        return
    for m in STATUS.finditer(text):
        found[m.group(2)] = f'https://x.com/{m.group(1)}/status/{m.group(2)}'

def walk_urls(o, found):
    if isinstance(o, dict):
        for v in o.values():
            walk_urls(v, found)
    elif isinstance(o, list):
        for v in o:
            walk_urls(v, found)
    elif isinstance(o, str):
        add_status(found, o)

def collect_ids():
    """Status ids the dashboard is responsible for caching.

    data JSON: any string that contains an X/Twitter status URL.
    heat_log.csv: the `source` cell. Count rows do not carry a post id;
    representative posts are rows whose source is the status URL
    (metric x_sample_post, or the existing x_post_views:@handle).
    """
    found = {}
    files = []
    if os.path.isdir(DATA):
        for fn in sorted(os.listdir(DATA)):
            if not fn.endswith('.json'):
                continue
            path = os.path.join(DATA, fn)
            files.append(path)
            try:
                walk_urls(json.load(open(path, encoding='utf-8')), found)
            except Exception:
                continue
    if os.path.exists(HEAT):
        with open(HEAT, encoding='utf-8') as f:
            for row in csv.DictReader(f):
                add_status(found, row.get('source') or '')
    return found, files

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
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            payload = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410, 451):
            return {'status': 'unavailable', 'error': f'HTTP {e.code}'}
        raise
    tw = (payload or {}).get('tweet') or {}
    text = (tw.get('text') or '').strip()
    author = tw.get('author') or {}
    handle = author.get('screen_name') or ''
    if not tw or not text:
        return {'status': 'unavailable', 'error': 'empty text' if tw else 'no tweet'}
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

def cache_ready(snap):
    if not snap:
        return False
    if snap.get('status') == 'unavailable':
        return True
    return bool(str(snap.get('text') or '').strip())

def main():
    found, files = collect_ids()
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
        'note': NOTE,
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
    """Fetch status ids cited in data JSON or heat_log.csv that have no text.

    Existing ok entries are left untouched. status=unavailable is terminal.
    A network failure is stored as status=missing with no invented text.
    """
    found, _files = collect_ids()
    posts = {}
    doc = {}
    if os.path.exists(OUT):
        try:
            doc = json.load(open(OUT, encoding='utf-8'))
            posts = doc.get('posts') or {}
        except Exception:
            posts = {}
    missing = [sid for sid in sorted(found) if not cache_ready(posts.get(sid))]
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
        'note': NOTE,
        'posts': posts,
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('x cache updated', len(posts))

if __name__ == '__main__':
    main()
