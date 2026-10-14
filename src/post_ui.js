/* Shared post UI for the board and for static event pages.
   Logos, 展开, heat badge, original-text block, newest-first timeline.
   Browser: window.PostUI. Node: module.exports. No invented post text. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PostUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var FOLD_X = 72;
  var FOLD_SUM = 40;
  var MISS = '原文未缓存';
  var LOGOS = {
    x: '<svg class="plogo" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    xhs: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="#ff2442"/><text x="8" y="12" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="PingFang SC,Noto Sans SC,sans-serif">小</text></svg>',
    weibo: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#e6162d"/><ellipse cx="8" cy="8.4" rx="5" ry="3" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="10.1" cy="8.3" r="1.45" fill="#fff"/></svg>',
    wx: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="#07c160"/><circle cx="6.1" cy="7" r="3.1" fill="#fff"/><circle cx="10.3" cy="9.3" r="2.5" fill="#fff"/><circle cx="5.2" cy="6.7" r=".55" fill="#07c160"/><circle cx="7" cy="6.7" r=".55" fill="#07c160"/><circle cx="9.6" cy="9" r=".45" fill="#07c160"/><circle cx="11" cy="9" r=".45" fill="#07c160"/></svg>'
  };
  var PNAME = { x: 'X', xhs: '小红书', weibo: '微博', wx: '微信' };
  var LANG = { en: '英文', ja: '日文', jp: '日文', ko: '韩文', es: '西班牙文', pt: '葡萄牙文', fr: '法文', de: '德文', ru: '俄文', ar: '阿拉伯文', zh: '中文' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function plainLen(html) {
    return String(html || '').replace(/<[^>]+>/g, '').replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, 'x').replace(/\s+/g, '').length;
  }
  function xId(url) {
    var m = String(url || '').match(/status\/(\d+)/);
    return m ? m[1] : '';
  }
  function platform(url) {
    var host = '';
    try { host = new URL(String(url), 'https://local.invalid').hostname.toLowerCase().replace(/^www\./, ''); }
    catch (e) { return ''; }
    if (!host || host === 'local.invalid') return '';
    if (host === 'x.com' || host === 'twitter.com' || host === 't.co' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) return 'x';
    if (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || host === 'xhslink.com' || host.endsWith('.xhslink.com')) return 'xhs';
    if (host === 'weibo.com' || host.endsWith('.weibo.com') || host === 'weibo.cn' || host.endsWith('.weibo.cn')) return 'weibo';
    if (host === 'weixin.qq.com' || host.endsWith('.weixin.qq.com') || host === 'wechat.com' || host.endsWith('.wechat.com')) return 'wx';
    return '';
  }
  function extLink(url, label, opt) {
    if (!url) return '';
    var p = platform(url);
    var cls = p ? 'ext ext-' + p : 'ext';
    var tip = p ? ' title="' + esc(PNAME[p]) + '"' : '';
    var logo = p ? LOGOS[p] : '';
    var text = (opt && opt.html) ? String(label || '') : esc(label || url);
    return '<a class="' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener"' + tip + '>' + logo + '<span>' + text + '</span></a>';
  }
  function foldable(cls, html, opt) {
    var n = plainLen(html);
    var limit = (opt && opt.limit) || (cls === 'xtext' || cls === 'oline' ? FOLD_X : FOLD_SUM);
    var long = n > limit;
    return '<div class="clampbox" data-len="' + n + '" data-fold="' + limit + '"><p class="' + cls + ' clamp">' + html + '</p><button type="button" class="xmore"' + (long ? '' : ' hidden') + ' aria-expanded="false">展开</button></div>';
  }
  function langLabel(lang) {
    var k = String(lang || '').toLowerCase();
    if (!k) return '外文';
    return LANG[k] || LANG[k.split('-')[0]] || k;
  }
  var TRACKER_ALIASES = ['滴滴 & 滴滴出海', '滴滴 & 出海', '滴滴 & DiDi 出海'];
  function trackerName(longterm) {
    var list = longterm || [];
    for (var i = 0; i < list.length; i++) {
      var n = String(list[i].name || '');
      if (n.indexOf('滴滴') >= 0) return n;
    }
    return '滴滴';
  }
  function displayLabel(text, name) {
    var raw = String(text == null ? '' : text);
    var trimmed = raw.trim();
    if (!trimmed) return raw;
    var core = trimmed.replace(/^[^\u4e00-\u9fffA-Za-z0-9]+/, '');
    var lead = trimmed.slice(0, trimmed.length - core.length);
    var label = name || '滴滴';
    for (var i = 0; i < TRACKER_ALIASES.length; i++) {
      var alias = TRACKER_ALIASES[i];
      if (core === alias || core.indexOf(alias) === 0) return lead + label + core.slice(alias.length);
    }
    return raw;
  }
  function placeTag(post) {
    var bits = [];
    if (post && post.country) bits.push(String(post.country));
    if (post && post.lang) bits.push(langLabel(post.lang));
    return bits.join(' · ');
  }
  function isZh(lang) {
    return /^zh\b/i.test(String(lang || ''));
  }
  function needsTranslation(post) {
    var lang = String((post && post.lang) || '');
    var tr = String((post && post.translation_zh) || '');
    var text = String((post && post.text) || '');
    if (!tr || tr === text) return false;
    if (!lang) return true;
    return !isZh(lang);
  }
  function parseViews(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    var s = String(v).replace(/,/g, '');
    var m = s.match(/([\d.]+)\s*(万|亿|[kKmM])?/);
    if (!m) return 0;
    var n = +m[1];
    var mul = { '万': 1e4, '亿': 1e8, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]] || 1;
    return n * mul;
  }
  function fmtNum(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string' && /[万亿kKmM]/.test(v) && /[^\d.]/.test(v)) return String(v);
    var n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    if (!isFinite(n)) return String(v);
    if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 1 : 2).replace(/\.?0+$/, '') + '万';
    return String(Math.round(n));
  }
  function heatBadge(views, maxViews) {
    var n = typeof views === 'number' ? views : parseViews(views);
    if (!n) return '';
    var word = n >= 1e5 ? '爆' : n >= 1e4 ? '热' : '温';
    var cls = n >= 1e5 ? 'bao' : n >= 1e4 ? 're' : 'wen';
    var max = maxViews > 0 ? maxViews : n;
    var pct = Math.max(8, Math.round(100 * Math.sqrt(n / max)));
    var mark = cls === 'bao'
      ? '<span class="pstamp">爆</span>'
      : '<span class="pbadge ' + cls + '">' + word + '</span>';
    return '<div class="phr" data-heat="1">' + mark + '<span class="pnum">' + esc(fmtNum(n) + '浏览') + '</span><div class="phb"><i style="width:' + pct + '%"></i></div></div>';
  }
  function toIso(s) {
    var str = String(s || '').trim();
    var m = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!m) return '';
    var iso = m[1] + 'T' + m[2] + ':' + (m[3] || '00');
    var z = m[4];
    iso += (!z || z === 'Z') ? 'Z' : z;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function formatBeijing(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
      var g = function (t) { return parts.find(function (p) { return p.type === t; }).value; };
      return g('year') + '-' + g('month') + '-' + g('day') + ' ' + g('hour') + ':' + g('minute');
    } catch (e) {
      var x = new Date(d.getTime() + 8 * 3600000);
      function pad(n) { return String(n).padStart(2, '0'); }
      return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()) + ' ' + pad(x.getUTCHours()) + ':' + pad(x.getUTCMinutes());
    }
  }
  function timeHtml(created, opt) {
    if (!created) return '';
    var iso = toIso(created);
    var label = (opt && opt.formatTime) ? opt.formatTime(created) : (iso ? formatBeijing(iso) : String(created));
    if (!label) return '';
    if (iso) return '<time datetime="' + esc(iso) + '">' + esc(label) + '</time>';
    return '<span class="note">' + esc(label) + '</span>';
  }
  function snapOf(url, posts) {
    var id = xId(url);
    return (id && posts && posts[id]) || null;
  }
  function mergeSnap(src, posts) {
    src = src || {};
    var snap = snapOf(src.url, posts) || {};
    var text = String(src.text || snap.text || '').trim();
    return {
      url: src.url || snap.url || '',
      text: text,
      author: snap.author || src.author || '',
      author_name: snap.name || src.author_name || src.name || '',
      created_at: src.created_at || snap.created_at || '',
      views: src.views != null && src.views !== '' ? src.views : snap.views,
      likes: src.likes != null && src.likes !== '' ? src.likes : snap.likes,
      reposts: src.reposts != null && src.reposts !== '' ? src.reposts : snap.reposts,
      translation_zh: src.translation_zh || snap.translation_zh || '',
      lang: src.lang || snap.lang || '',
      country: src.country || snap.country || '',
      label: src.label || ''
    };
  }
  function sourcesOf(item, posts) {
    item = item || {};
    var d = item.detail || {};
    var out = [];
    var seen = {};
    function add(src) {
      if (!src) return;
      var merged = mergeSnap(src, posts);
      var id = xId(merged.url);
      var key = id || merged.url || ('t:' + merged.text.slice(0, 40));
      if (!key) return;
      var prev = seen[key];
      if (prev) {
        if (!prev.text && merged.text) prev.text = merged.text;
        if (!prev.translation_zh && merged.translation_zh) prev.translation_zh = merged.translation_zh;
        if (!prev.lang && merged.lang) prev.lang = merged.lang;
        if (!prev.country && merged.country) prev.country = merged.country;
        if (!prev.author && merged.author) prev.author = merged.author;
        if (!prev.author_name && merged.author_name) prev.author_name = merged.author_name;
        return;
      }
      seen[key] = merged;
      out.push(merged);
    }
    (d.x_posts || []).forEach(function (p) { add(p); });
    (item.links || []).forEach(function (l) {
      add({ url: l.url, views: l.views, author: l.label, label: l.label, text: l.text, translation_zh: l.translation_zh, lang: l.lang, country: l.country, created_at: l.created_at });
    });
    (d.comments || []).forEach(function (c) {
      add({ url: c.url, text: c.text, author: c.author, translation_zh: c.translation_zh, lang: c.lang });
    });
    var itemTr = item.translation_zh || d.translation_zh || '';
    var itemLang = item.lang || d.lang || '';
    var itemCountry = item.country || d.country || '';
    var itemOrig = String(item.original || d.original || '').trim();
    if (itemTr || itemLang || itemOrig || itemCountry) {
      var host = null;
      for (var i = 0; i < out.length; i++) if (out[i].text) { host = out[i]; break; }
      if (!host) {
        for (var j = 0; j < out.length; j++) if (!out[j].text) { host = out[j]; break; }
      }
      host = host || out[0];
      if (host) {
        var editorial = String(item.text || '').trim();
        if (itemOrig && (!host.text || host.text === editorial)) host.text = itemOrig;
        if (!host.translation_zh && itemTr) host.translation_zh = itemTr;
        if (!host.lang && itemLang) host.lang = itemLang;
        if (!host.country && itemCountry) host.country = itemCountry;
      }
    }
    if (!out.length) out.push(mergeSnap({ text: itemOrig, translation_zh: itemTr, lang: itemLang, country: itemCountry }, posts));
    return out;
  }
  function primaryOf(item, posts) {
    var all = sourcesOf(item, posts);
    for (var i = 0; i < all.length; i++) if (all[i].text || all[i].translation_zh) return all[i];
    return all[0];
  }
  function noteSpan(label, value) {
    if (value == null || value === '') return '';
    return '<span class="note">' + esc(label) + ' ' + esc(fmtNum(value)) + '</span>';
  }
  function origBlock(post, opt) {
    post = post || {};
    opt = opt || {};
    var clamp = opt.clamp !== false;
    var url = post.url || '';
    var text = String(post.text || '');
    var tr = String(post.translation_zh || '');
    var showTr = needsTranslation(post);
    var foreign = post.lang && !isZh(post.lang);
    var place = placeTag(post);
    var len = Math.max(plainLen(showTr ? tr : text), plainLen(text), plainLen(tr));
    var fold = FOLD_X;
    var long = len > fold;
    var p = platform(url);
    var who = [post.author_name, post.author].filter(Boolean).join(' ');
    var head = (p ? LOGOS[p] : '') + '<b>' + esc(who || (PNAME[p] || '原文')) + '</b>';
    if (showTr) head += '<span class="langtag">' + esc(place || langLabel(post.lang)) + ' · 译文</span>';
    else if (place && (foreign || post.country)) head += '<span class="langtag">' + esc(place) + '</span>';
    head += timeHtml(post.created_at, opt);
    head += noteSpan('浏览', post.views);
    head += noteSpan('赞', post.likes);
    head += noteSpan('转', post.reposts);
    var body;
    var miss = !text && !(showTr && tr);
    if (miss) {
      body = '<p class="xmiss">' + MISS + '</p>';
    } else if (showTr) {
      body = '<div class="clampbox" data-len="' + len + '" data-fold="' + fold + '" data-tr="1"><div class="clamp"><p class="xtext tr">' + esc(tr) + '</p></div><div class="orig-fold"><div class="langtag">原文 · ' + esc(place || langLabel(post.lang)) + '</div><p class="xtext">' + esc(text) + '</p></div><button type="button" class="xmore" aria-expanded="false">展开</button></div>';
    } else if (!clamp) {
      body = (place && (foreign || post.country) ? '<div class="langtag">原文 · ' + esc(place) + '</div>' : '') + '<p class="xtext">' + esc(text) + '</p>';
    } else {
      body = (place && (foreign || post.country) ? '<div class="langtag">原文 · ' + esc(place) + '</div>' : '') + '<div class="clampbox" data-len="' + len + '" data-fold="' + fold + '"><p class="xtext clamp">' + esc(text) + '</p><button type="button" class="xmore"' + (long ? '' : ' hidden') + ' aria-expanded="false">展开</button></div>';
    }
    var link = url ? extLink(url, '原链接') : '';
    return '<blockquote class="orig xbody" data-orig="1" data-len="' + len + '" data-fold="' + fold + '"' + (miss ? ' data-miss="1"' : '') + '><div class="poh xmeta">' + head + '</div>' + body + link + '</blockquote>';
  }
  function timeKey(s) {
    var str = String(s || '');
    var m = str.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 12, +(m[5] || 0));
    m = str.match(/(\d{4})-(\d{2})(?!\d)/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, 1, 12);
    m = str.match(/(\d{4})/);
    if (m) return Date.UTC(+m[1], 0, 1, 12);
    return null;
  }
  function sortNewest(nodes) {
    return (nodes || []).map(function (n, idx) {
      var copy = {};
      for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) copy[k] = n[k];
      copy._i = n.i != null ? n.i : idx;
      return copy;
    }).sort(function (a, b) {
      var ta = timeKey(a.date), tb = timeKey(b.date);
      if (ta != null && tb != null && ta !== tb) return tb - ta;
      if (ta != null && tb == null) return -1;
      if (tb != null && ta == null) return 1;
      return b._i - a._i;
    });
  }
  function urlsOf(it) {
    return ((it && it.links) || []).map(function (l) {
      return String(l.url || '').replace(/\/+$/, '').toLowerCase();
    }).filter(Boolean);
  }
  function itemSortDate(it) {
    it = it || {};
    var yearMatch = String(it.edition_date || it.edition_ts || '2026').match(/\d{4}/);
    var year = yearMatch ? yearMatch[0] : '2026';
    var d = String(it.date || '').trim();
    var m = d.match(/^(\d{1,2})-(\d{1,2})(?:\/(\d{1,2}))?(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m && !/^\d{4}/.test(d)) {
      var mo = ('0' + m[1]).slice(-2);
      var day = ('0' + (m[3] || m[2])).slice(-2);
      if (m[4] != null) return year + '-' + mo + '-' + day + 'T' + ('0' + m[4]).slice(-2) + ':' + m[5] + ':00Z';
      return year + '-' + mo + '-' + day;
    }
    if (timeKey(d)) return d;
    return String(it.edition_ts || it.edition_date || d || '');
  }
  function isZhLang(lang) {
    var s = String(lang || '');
    if (!s) return false;
    if (/^zh/i.test(s)) return true;
    return s.indexOf('中文') >= 0 || s.indexOf('简体') >= 0 || s.indexOf('繁体') >= 0;
  }
  function isForeignLead(it) {
    var sec = String((it && (it.section || it._sec)) || '');
    if (sec.indexOf('海外小语种') >= 0) return true;
    var lang = String((it && it.lang) || ((it && it.detail) || {}).lang || '');
    return !!lang && !isZhLang(lang);
  }
  function isStatusStub(it) {
    var t = String((it && it.text) || '').trim();
    return t.indexOf('本期无新动态') === 0 || t.indexOf('本期无重大新动态') === 0 || t.indexOf('本期有新动态') === 0;
  }
  function richness(it) {
    var n = 0;
    if (String((it && it.original) || '').trim()) n += 8;
    if (String((it && it.translation_zh) || '').trim()) n += 4;
    n += Math.min(3, ((it && it.links) || []).length);
    n += Math.min(3, String((it && it.text) || '').length / 120);
    if (String((it && it.id) || '').indexOf('-didi-') >= 0) n += 0.5;
    return n;
  }
  function didiTimeline(items) {
    var list = items || [];
    var stubsIn = [];
    var stories = [];
    list.forEach(function (it) {
      if (isStatusStub(it)) stubsIn.push(it);
      else stories.push(it);
    });
    var parent = stories.map(function (_, i) { return i; });
    function find(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    function unite(a, b) {
      a = find(a); b = find(b);
      if (a !== b) parent[b] = a;
    }
    var byKey = {};
    stories.forEach(function (it, i) {
      var urls = urlsOf(it);
      var keys = urls.length ? urls : ['t:' + String(it.company || '') + '|' + String(it.text || '').replace(/\s+/g, '').slice(0, 48)];
      keys.forEach(function (k) {
        if (byKey[k] != null) unite(i, byKey[k]);
        else byKey[k] = i;
      });
    });
    var buckets = {};
    stories.forEach(function (it, i) {
      var r = find(i);
      (buckets[r] = buckets[r] || []).push(it);
    });
    var winners = [];
    var covered = [];
    stubsIn.forEach(function (it) { if (it.id) covered.push(it.id); });
    Object.keys(buckets).forEach(function (k) {
      var group = buckets[k];
      var best = group[0];
      var bestScore = richness(best);
      group.forEach(function (it) {
        if (it.id) covered.push(it.id);
        var score = richness(it);
        if (score > bestScore) { best = it; bestScore = score; }
      });
      winners.push(best);
    });
    function pack(arr) {
      return sortNewest(arr.map(function (it, i) {
        return { date: itemSortDate(it), i: i, item: it };
      })).map(function (n) { return n.item; });
    }
    var foreign = [], rest = [], stubs = stubsIn.slice();
    winners.forEach(function (it) {
      if (isForeignLead(it)) foreign.push(it);
      else rest.push(it);
    });
    foreign = pack(foreign);
    rest = pack(rest);
    stubs = pack(stubs);
    return { foreign: foreign, rest: rest, stubs: stubs, shown: foreign.concat(rest, stubs), coveredIds: covered };
  }
  function viewsOf(item) {
    var m = 0;
    ((item && item.links) || []).forEach(function (l) { m = Math.max(m, parseViews(l.views)); });
    var posts = item && item.detail && item.detail.x_posts || [];
    posts.forEach(function (p) { m = Math.max(m, parseViews(p.views)); });
    return m;
  }
  function renderBits(input) {
    input = input || {};
    var posts = input.posts || {};
    var items = input.items || [];
    var maxV = 0;
    items.forEach(function (it) { maxV = Math.max(maxV, viewsOf(it)); });
    if (input.maxViews) maxV = Math.max(maxV, input.maxViews);
    var ext = {};
    (input.pairs || []).forEach(function (p) {
      if (!p || !p.url) return;
      var label = p.label || p.url;
      ext[p.url + '\n' + label] = extLink(p.url, label);
    });
    var byId = {};
    items.forEach(function (it) {
      var sources = sourcesOf(it, posts);
      var seen = {};
      sources.forEach(function (s) { if (s.url) seen[s.url] = 1; });
      var d = it.detail || {};
      var tl = ((d.timeline) || []).map(function (t, i) {
        return { date: t.date || '', text: t.text || '', url: t.url || '', i: i };
      });
      var sorted = sortNewest(tl);
      byId[it.id] = {
        orig: sources.map(function (s) { return origBlock(s, { clamp: true }); }).join(''),
        heat: heatBadge(viewsOf(it), maxV || 1),
        timeline: sorted.map(function (t) {
          var extra = '';
          if (t.url && !seen[t.url]) extra = origBlock(mergeSnap({ url: t.url }, posts), { clamp: true });
          return { date: t.date, text: t.text, url: t.url, orig: extra };
        })
      };
    });
    return { byId: byId, ext: ext };
  }
  function wireClamps(root) {
    if (typeof document === 'undefined') return;
    (root || document).querySelectorAll('.clampbox').forEach(function (box) {
      var el = box.querySelector('.clamp');
      var btn = box.querySelector('.xmore');
      if (!el || !btn) return;
      if (box.classList.contains('is-open')) {
        btn.hidden = false;
        btn.textContent = '收起';
        btn.setAttribute('aria-expanded', 'true');
        return;
      }
      if (box.getAttribute('data-tr') === '1') {
        btn.hidden = false;
        btn.textContent = '展开';
        btn.setAttribute('aria-expanded', 'false');
        return;
      }
      var force = (+box.getAttribute('data-len') || 0) > (+box.getAttribute('data-fold') || 80);
      if (box.offsetParent === null) {
        if (force) btn.hidden = false;
        return;
      }
      var overflow = el.scrollHeight > el.clientHeight + 2;
      btn.hidden = !(force || overflow);
      btn.textContent = '展开';
      btn.setAttribute('aria-expanded', 'false');
    });
  }
  function bind(doc) {
    if (typeof document === 'undefined') return;
    doc = doc || document;
    if (doc.__postUiBound) return;
    doc.__postUiBound = true;
    doc.addEventListener('click', function (e) {
      var heatBtn = e.target.closest && e.target.closest('.heat-toggle');
      if (heatBtn) {
        e.preventDefault();
        e.stopPropagation();
        var how = heatBtn.closest('.heat-how');
        if (how) {
          var open = how.classList.toggle('is-open');
          heatBtn.textContent = open ? '收起' : '展开';
          heatBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        return;
      }
      var box = e.target.closest && e.target.closest('.clampbox');
      if (box && !(e.target.closest && e.target.closest('a'))) {
        var btn = box.querySelector('.xmore');
        if (btn && !btn.hidden) {
          e.preventDefault();
          e.stopPropagation();
          var opened = box.classList.toggle('is-open');
          btn.textContent = opened ? '收起' : '展开';
          btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
        }
      }
    }, true);
  }

  return {
    FOLD_X: FOLD_X,
    FOLD_SUM: FOLD_SUM,
    MISS: MISS,
    LOGOS: LOGOS,
    esc: esc,
    plainLen: plainLen,
    xId: xId,
    platform: platform,
    extLink: extLink,
    foldable: foldable,
    heatBadge: heatBadge,
    parseViews: parseViews,
    fmtNum: fmtNum,
    mergeSnap: mergeSnap,
    sourcesOf: sourcesOf,
    primaryOf: primaryOf,
    origBlock: origBlock,
    sortNewest: sortNewest,
    timeKey: timeKey,
    viewsOf: viewsOf,
    renderBits: renderBits,
    wireClamps: wireClamps,
    bind: bind,
    langLabel: langLabel,
    trackerName: trackerName,
    displayLabel: displayLabel,
    placeTag: placeTag,
    didiTimeline: didiTimeline,
    itemSortDate: itemSortDate
  };
});

if (typeof require !== 'undefined' && require.main === module) {
  var fn = process.argv[2];
  var raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function (c) { raw += c; });
  process.stdin.on('end', function () {
    try {
      var input = raw ? JSON.parse(raw) : {};
      var api = module.exports;
      if (!fn || typeof api[fn] !== 'function') throw new Error('unknown method ' + fn);
      var out = api[fn](input);
      process.stdout.write(JSON.stringify(out));
    } catch (err) {
      process.stderr.write(String(err && err.stack || err));
      process.exit(1);
    }
  });
}
