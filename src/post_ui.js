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
  var UNAVAIL = '原文不可用';
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
      label: src.label || '',
      status: src.status || snap.status || ''
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
    var gone = miss && post.status === 'unavailable';
    if (miss) {
      body = '<p class="xmiss">' + (gone ? UNAVAIL : MISS) + '</p>';
    } else if (showTr) {
      body = '<div class="clampbox" data-len="' + len + '" data-fold="' + fold + '" data-tr="1"><div class="clamp"><p class="xtext tr">' + esc(tr) + '</p></div><div class="orig-fold"><div class="langtag">原文 · ' + esc(place || langLabel(post.lang)) + '</div><p class="xtext">' + esc(text) + '</p></div><button type="button" class="xmore" aria-expanded="false">展开</button></div>';
    } else if (!clamp) {
      body = (place && (foreign || post.country) ? '<div class="langtag">原文 · ' + esc(place) + '</div>' : '') + '<p class="xtext">' + esc(text) + '</p>';
    } else {
      body = (place && (foreign || post.country) ? '<div class="langtag">原文 · ' + esc(place) + '</div>' : '') + '<div class="clampbox" data-len="' + len + '" data-fold="' + fold + '"><p class="xtext clamp">' + esc(text) + '</p><button type="button" class="xmore"' + (long ? '' : ' hidden') + ' aria-expanded="false">展开</button></div>';
    }
    var link = url ? extLink(url, '原链接') : '';
    return '<blockquote class="orig xbody" data-orig="1" data-len="' + len + '" data-fold="' + fold + '"' + (gone ? ' data-unavail="1"' : (miss ? ' data-miss="1"' : '')) + '><div class="poh xmeta">' + head + '</div>' + body + link + '</blockquote>';
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
  var FRONT_FRESH_H = 48;
  var FRONT_HALF_H = 36;
  function frontScore(views, hours, delta) {
    var h = Math.max(0, Number(hours) || 0);
    var score = (Number(views) || 0) * Math.pow(0.5, h / 36);
    if (delta != null && delta !== '' && isFinite(+delta)) {
      if (+delta > 0 && h <= 48) score *= 1.25;
      if (+delta <= 0 && h > 48) score *= 0.5;
    }
    return score;
  }
  var TOPIC_STOP = { '争议': 1, '事件': 1, '公司': 1, '相关': 1, '热点': 1, '大厂': 1 };
  function topicParts(topic) {
    var raw = String(topic || '');
    var strong = [];
    var weak = [];
    var seen = {};
    function add(list, s) {
      s = String(s || '').trim();
      if (s.length < 2 || seen[s] || TOPIC_STOP[s]) return;
      seen[s] = 1;
      list.push(s);
    }
    raw.split(/[\s（）()\[\]【】、,，/|&+""“”'’·.：:—\-]+/).forEach(function (part) {
      var runs = part.match(/[\u4e00-\u9fff]{2,}/g) || [];
      runs.forEach(function (run) {
        if (run.length === 2) add(strong, run);
        if (run.length >= 3) add(strong, run);
        var n, i;
        for (n = 3; n <= 4; n++) {
          for (i = 0; i + n <= run.length; i++) add(strong, run.slice(i, i + n));
        }
        if (run.length >= 4) {
          for (i = 0; i + 2 <= run.length; i++) add(weak, run.slice(i, i + 2));
        }
      });
      (part.match(/[A-Za-z][A-Za-z0-9]{2,}/g) || []).forEach(function (w) { if (w.length >= 3) add(strong, w); });
    });
    return { strong: strong, weak: weak };
  }
  function topicScore(parts, title, company, body) {
    var head = 0;
    var bodyN = 0;
    var titleHit = 0;
    (parts.strong || []).forEach(function (p) {
      var k = p.toLowerCase();
      var inTitle = title.indexOf(k) >= 0;
      var inCo = company.indexOf(k) >= 0;
      var w = p.length >= 4 ? p.length * 6 : (p.length === 3 ? p.length * 4 : 3);
      if (inTitle) { head += w; titleHit += p.length; }
      else if (inCo) head += Math.max(1, Math.floor(w / 2));
      else if (p.length >= 4 && body.indexOf(k) >= 0) bodyN += p.length;
    });
    (parts.weak || []).forEach(function (p) {
      if (title.indexOf(p.toLowerCase()) >= 0) titleHit += 1;
    });
    return { n: head > 0 ? head + bodyN : 0, titleHit: titleHit };
  }
  var GENERIC_TOKEN = {
    '微博': 1, '热搜': 1, '微博热搜': 1, '热搜第一': 1, '官方': 1, '回应': 1, '官方回应': 1,
    '公司': 1, '事件': 1, '争议': 1, '相关': 1, '热点': 1, '大厂': 1, '媒体': 1, '报道': 1,
    '中国': 1, '美国': 1, '今日': 1, '第一': 1, '上市': 1, '港股': 1, '港股上市': 1,
    'ipo': 1, 'ai': 1, '声明': 1, '发布': 1
  };
  var GENERIC_KEYS = null;
  function genericKeyList() {
    if (!GENERIC_KEYS) GENERIC_KEYS = Object.keys(GENERIC_TOKEN).sort(function (a, b) { return b.length - a.length; });
    return GENERIC_KEYS;
  }
  function flatText(s) {
    return String(s || '').toLowerCase().replace(/[^\u4e00-\u9fffa-z0-9]/g, '');
  }
  function isGenericSlice(sub) {
    if (!sub || GENERIC_TOKEN[sub]) return true;
    var left = sub;
    genericKeyList().forEach(function (g) {
      if (g.length >= 2) left = left.split(g).join('');
    });
    return left.replace(/\d/g, '').length < 2;
  }
  function hayOf(c) {
    var title = flatText(c && c.title);
    if (title) return title;
    return flatText(c && c.company);
  }
  function sliceScore(topic, hay, minLen) {
    var t = flatText(topic);
    if (!t || !hay || t.length < minLen) return 0;
    var slices = [];
    var n, i, sub, maxN = Math.min(t.length, 18);
    for (n = minLen; n <= maxN; n++) {
      for (i = 0; i + n <= t.length; i++) {
        sub = t.slice(i, i + n);
        if (isGenericSlice(sub) || /^\d+$/.test(sub)) continue;
        if (/^[a-z0-9]+$/.test(sub) && sub.length < 4) continue;
        if (hay.indexOf(sub) >= 0) slices.push(sub);
      }
    }
    var maximal = slices.filter(function (s) {
      return !slices.some(function (o) { return o.length > s.length && o.indexOf(s) >= 0; });
    });
    var score = 0;
    maximal.forEach(function (s) { score += s.length * (s.length >= 4 ? 6 : 4); });
    return score;
  }
  function scoreMatch(topic, c) {
    if (!c || !c.id) return null;
    var title = flatText(c.title);
    var company = flatText(c.company);
    var hay = title || company;
    if (!hay) return null;
    var strong = sliceScore(topic, hay, 4);
    var n = strong ? strong + 100 : sliceScore(topic, hay, 2);
    if (!n) return null;
    var blob = flatText(c.blob || c.text || '');
    return {
      id: c.id,
      n: n,
      extra: blob ? sliceScore(topic, blob, 4) : 0,
      cover: sliceScore(topic, hay, 2),
      time: +c.time || +c.progressMs || 0,
      titled: !!(title && sliceScore(topic, title, 4))
    };
  }
  function preferMatch(row, best) {
    if (row.titled !== best.titled) {
      var titled = row.titled ? row : best;
      var other = row.titled ? best : row;
      if (titled.n >= other.n * 0.6) return titled;
      return other.n >= titled.n ? other : titled;
    }
    var hi = Math.max(row.n, best.n);
    var lo = Math.min(row.n, best.n);
    var close = hi > 0 && lo >= hi * 0.75;
    if (!close) return row.n > best.n ? row : best;
    var ehi = Math.max(row.extra, best.extra);
    var elo = Math.min(row.extra, best.extra);
    if (ehi && elo < ehi * 0.75) return row.extra > best.extra ? row : best;
    if (Math.abs(row.cover - best.cover) >= 8) return row.cover > best.cover ? row : best;
    if (row.time !== best.time) return row.time > best.time ? row : best;
    if (row.n !== best.n) return row.n > best.n ? row : best;
    if (row.extra !== best.extra) return row.extra > best.extra ? row : best;
    if (row.cover !== best.cover) return row.cover > best.cover ? row : best;
    return best;
  }
  function matchTopic(topic, candidates) {
    var best = null;
    (candidates || []).forEach(function (c) {
      var row = scoreMatch(topic, c);
      if (!row) return;
      best = best ? preferMatch(row, best) : row;
    });
    return best ? best.id : '';
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
        var onBtn = !!(e.target.closest && e.target.closest('.xmore'));
        if (!onBtn) {
          // Body clicks never collapse an open box, and a text selection never toggles it.
          if (box.classList.contains('is-open')) return;
          var sel = window.getSelection && window.getSelection();
          if (sel && !sel.isCollapsed && String(sel).trim()) return;
        }
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

  function viewNum(v) {
    var n = parseViews(v);
    return n == null || !isFinite(n) ? 0 : n;
  }
  function orderPosts(list) {
    return (list || []).slice().sort(function (a, b) {
      var ta = timeKey(a.created_at) || 0;
      var tb = timeKey(b.created_at) || 0;
      if (tb !== ta) return tb - ta;
      return viewNum(b.views) - viewNum(a.views);
    });
  }
  function statusUrls(text) {
    var out = [];
    var re = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/ig;
    var m;
    var s = String(text || '');
    while ((m = re.exec(s))) out.push(m[0]);
    return out;
  }
  function normTopic(s) {
    return String(s || '').replace(/\s+/g, '').replace(/[“”"']/g, '').toLowerCase();
  }
  function oneLine(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    var parts = s.split(/([。！？!?])/);
    var out = '';
    for (var i = 0; i < parts.length; i += 2) {
      out += (parts[i] || '') + (parts[i + 1] || '');
      if (out.replace(/\s/g, '').length >= 18) break;
    }
    out = out.trim();
    if (out.length > 90) out = out.slice(0, 90) + '…';
    return out;
  }
  function heatSamples(topic, heatRows, posts, items) {
    var key = normTopic(topic);
    var seen = {};
    var list = [];
    (heatRows || []).forEach(function (r) {
      if (normTopic(r.topic) !== key) return;
      var metric = String(r.metric || '');
      var rowViews = (/^x_sample_post$/.test(metric) || /views/i.test(metric)) ? r.value : null;
      statusUrls(r.source).forEach(function (url) {
        var id = xId(url);
        if (!id || seen[id]) return;
        var snap = (posts && posts[id]) || {};
        var merged = mergeSnap({
          url: snap.url || url,
          text: snap.text || '',
          author: snap.author || '',
          created_at: snap.created_at || '',
          views: snap.views != null && snap.views !== '' ? snap.views : rowViews,
          likes: snap.likes,
          reposts: snap.reposts,
          status: snap.status || ''
        }, posts);
        if (snap.text) merged.text = snap.text;
        if (snap.name && !merged.author_name) merged.author_name = snap.name;
        merged.status = snap.status || merged.status || '';
        seen[id] = merged;
        list.push(merged);
      });
    });
    var meta = {};
    (items || []).forEach(function (it) {
      sourcesOf(it, posts).forEach(function (s) {
        var id = xId(s.url);
        if (id) meta[id] = s;
      });
    });
    list.forEach(function (p) {
      var s = meta[xId(p.url)];
      if (!s) return;
      if (!p.translation_zh && s.translation_zh) p.translation_zh = s.translation_zh;
      if (!p.lang && s.lang) p.lang = s.lang;
      if (!p.country && s.country) p.country = s.country;
    });
    return orderPosts(list);
  }
  function heatAbout(samples) {
    var line = '';
    (samples || []).forEach(function (p) {
      if (line || !p || p.status === 'unavailable') return;
      var src = (needsTranslation(p) && p.translation_zh) ? p.translation_zh : p.text;
      line = oneLine(src);
    });
    return line;
  }
  function heatEmptyReason(topic, samples, heatRows) {
    var usable = (samples || []).some(function (p) {
      return String((p && p.text) || '').trim() || String((p && p.translation_zh) || '').trim() || (p && p.status === 'unavailable');
    });
    if (usable) return '';
    var rows = (heatRows || []).filter(function (r) { return normTopic(r.topic) === normTopic(topic); });
    var metrics = {};
    rows.forEach(function (r) { metrics[String(r.metric || '')] = 1; });
    var keys = Object.keys(metrics);
    var weibo = keys.some(function (k) { return k.indexOf('weibo') >= 0; });
    var hasX = keys.some(function (k) { return k.indexOf('x_') === 0; });
    if (!rows.length) return '没有代表帖。heat_log 里没有这个话题的记录，不能编原文。';
    if (weibo && !hasX) return '没有代表帖。heat_log 只记了微博热搜名次或分数，source 不是 X status 链接，所以没有可缓存的原文。';
    return '没有代表帖。heat_log 只记了发帖量或计数，source 里没有 X status 链接。';
  }
  function seriesStamp(r) {
    var m = String(r.metric || '').match(/^x_daily_post_count_(\d{2})(\d{2})$/);
    if (m) {
      var year = String(r.timestamp_utc || '2026').slice(0, 4) || '2026';
      return year + '-' + m[1] + '-' + m[2] + 'T12:00:00Z';
    }
    return r.timestamp_utc || '';
  }
  function topicSeriesOf(topic, heat) {
    var pts = [];
    (heat || []).forEach(function (r) {
      if (!r || r.topic !== topic) return;
      var metric = String(r.metric || '');
      var daily = metric === 'x_daily_post_count' || /^x_daily_post_count_\d{4}$/.test(metric);
      var partialMetric = metric.indexOf('partial') >= 0;
      if (!daily && !partialMetric) return;
      var partialDay = /_to_\d{1,2}Z/i.test(String(r.source || ''));
      pts.push({ t: seriesStamp(r), v: +r.value, partial: !!(partialMetric || (daily && partialDay)) });
    });
    pts.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    return pts;
  }
  function heatClock(heat) {
    var best = 0;
    (heat || []).forEach(function (r) {
      var t = Date.parse(r.timestamp_utc);
      if (t > best) best = t;
    });
    return best;
  }
  function isViewMetric(metric) {
    var m = String(metric || '');
    return m === 'x_sample_post' || m.indexOf('x_sample_post') === 0 || m.indexOf('views') >= 0;
  }
  function isCountMetric(metric) {
    var m = String(metric || '');
    if (!m || isViewMetric(m) || m === 'hours_since_last_progress') return false;
    if (m.indexOf('repl') >= 0 || m.indexOf('like') >= 0 || m.indexOf('weibo') >= 0) return false;
    if (m.indexOf('search_posts') >= 0) return false;
    return m.indexOf('post_count') >= 0 || m.indexOf('posts_') >= 0 || m.indexOf('x_posts') >= 0 || m.indexOf('x_hourly') >= 0 || m.indexOf('per_hour') >= 0;
  }
  function isHourlyMetric(metric) {
    var m = String(metric || '');
    if (/_sum/.test(m)) return false;
    return /hourly|per_hour|x_hourly_posts_|x_posts_hour_|x_hourly_post_count/.test(m);
  }
  function windowEndHour(row) {
    var metric = String(row.metric || '');
    var refresh = metric.match(/_(\d{2})(\d{2})Z/);
    if (refresh) return +refresh[2];
    var blob = metric + ' ' + String(row.source || '');
    if (/since_/i.test(metric)) return 0;
    var all = blob.match(/(\d{1,2})Z/gi) || [];
    if (!all.length) return 0;
    var last = all[all.length - 1].match(/(\d{1,2})/);
    return last ? +last[1] : 0;
  }
  function betterCount(a, b) {
    if ((a.timestamp_utc || '') !== (b.timestamp_utc || '')) return (a.timestamp_utc || '') > (b.timestamp_utc || '') ? a : b;
    var ah = isHourlyMetric(a.metric) ? 1 : 0;
    var bh = isHourlyMetric(b.metric) ? 1 : 0;
    if (ah !== bh) return ah > bh ? a : b;
    var ae = windowEndHour(a);
    var be = windowEndHour(b);
    if (ae !== be) return ae > be ? a : b;
    var an = /task_broad|_sum/.test(a.metric) ? 1 : 0;
    var bn = /task_broad|_sum/.test(b.metric) ? 1 : 0;
    if (an !== bn) return an < bn ? a : b;
    return b;
  }
  function coveredHours(row) {
    var metric = String(row.metric || '');
    var source = String(row.source || '');
    var blob = metric + ' ' + source;
    if (isHourlyMetric(metric)) return 1;
    if (/^x_daily_post_count($|_)/.test(metric)) {
      var to = source.match(/_to_(\d{1,2})Z/i) || metric.match(/_to_(\d{1,2})Z/i);
      if (to) return Math.max(1, +to[1] || 1);
      return 24;
    }
    var mins = metric.match(/(\d+)\s*min/i);
    if (mins) return Math.max(1 / 60, +mins[1] / 60);
    var clock = blob.match(/(\d{1,2}):(\d{2})\s*[–\-~到至]\s*(\d{1,2}):(\d{2})/);
    if (clock) {
      var a = +clock[1] + (+clock[2]) / 60;
      var b = +clock[3] + (+clock[4]) / 60;
      var span = b - a;
      if (span <= 0) span += 24;
      return Math.max(span, 0.25);
    }
    var minSpan = metric.match(/(\d{1,2})Z_to(\d{2})(\d{2})/i);
    if (minSpan) {
      var a2 = +minSpan[1];
      var b2 = +minSpan[2] + (+minSpan[3]) / 60;
      var span2 = b2 - a2;
      if (span2 <= 0) span2 += 24;
      return Math.max(span2, 0.25);
    }
    var range = metric.match(/(\d{1,2})Z?(?:_to_|to|_|–|-|到)(\d{1,2})Z/i);
    if (range) {
      var s = +range[1];
      var e = +range[2];
      var d = e - s;
      if (d <= 0) d += 24;
      return Math.max(d, 1);
    }
    var sinceFull = metric.match(/since_(\d{4})(\d{2})(\d{2})T(\d{2})Z/i);
    var sinceMd = metric.match(/since_(\d{2})(\d{2})_(\d{2})Z/i);
    if ((sinceFull || sinceMd) && row.timestamp_utc) {
      var start = 0;
      if (sinceFull) start = Date.parse(sinceFull[1] + '-' + sinceFull[2] + '-' + sinceFull[3] + 'T' + sinceFull[4] + ':00:00Z');
      else start = Date.parse(String(row.timestamp_utc).slice(0, 4) + '-' + sinceMd[1] + '-' + sinceMd[2] + 'T' + sinceMd[3] + ':00:00Z');
      var end = Date.parse(row.timestamp_utc);
      if (start && end > start) return Math.max(0.25, (end - start) / 3600000);
    }
    var wh = blob.match(/(\d+(?:\.\d+)?)\s*(?:h|小时)/i);
    if (wh) return Math.max(0.25, +wh[1]);
    if (metric.indexOf('partial') >= 0) {
      var ts = Date.parse(row.timestamp_utc);
      if (ts) {
        var dt = new Date(ts);
        return Math.max(1, dt.getUTCHours() + dt.getUTCMinutes() / 60);
      }
    }
    return 24;
  }
  function perHourOf(row) {
    var hours = coveredHours(row);
    var v = +row.value || 0;
    if (!hours) return 0;
    return v / hours;
  }
  function wanText(n) {
    n = +n || 0;
    if (n >= 10000) {
      var w = n / 10000;
      if (w >= 100) return Math.round(w) + '万';
      var one = Math.round(w * 10) / 10;
      return (one % 1 ? one : Math.round(one)) + '万';
    }
    return String(Math.round(n));
  }
  function weiboText(rank, heat) {
    var s = rank > 0 ? '微博热搜 #' + rank : '微博热搜';
    if (heat > 0) s += ' · ' + wanText(heat);
    return s;
  }
  function weiboScore(rank, heat) {
    var base = 0;
    if (rank > 0 && rank <= 10) base = 50 + (11 - rank) * 8;
    else if (rank > 10 && rank <= 50) base = Math.max(1, 48 * Math.pow(0.82, rank - 10));
    else if (heat > 0) base = Math.min(160, heat / 20000);
    var boost = (rank > 0 && heat > 0) ? Math.min(30, heat / 100000) : 0;
    return base + boost;
  }
  function rateText(n) {
    var v = Math.round((+n || 0) * 10) / 10;
    var s = Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : String(v);
    return '每小时 ' + s + ' 帖';
  }
  function newestWeibo(rs) {
    var rows = (rs || []).filter(function (r) { return r.metric === 'weibo_rank' || r.metric === 'weibo_heat'; });
    if (!rows.length) return null;
    var stamp = '';
    rows.forEach(function (r) { if ((r.timestamp_utc || '') > stamp) stamp = r.timestamp_utc || ''; });
    var rank = 0;
    var heat = 0;
    var rankRow = null;
    var heatRow = null;
    rows.forEach(function (r) {
      if ((r.timestamp_utc || '') !== stamp) return;
      if (r.metric === 'weibo_rank') { rank = +r.value || 0; rankRow = r; }
      if (r.metric === 'weibo_heat') { heat = +r.value || 0; heatRow = r; }
    });
    if (!(rank > 0) && !(heat > 0)) return null;
    return { rank: rank, heat: heat, row: rankRow || heatRow, score: weiboScore(rank, heat), text: weiboText(rank, heat) };
  }
  function pickSignal(rs) {
    var counts = (rs || []).filter(function (r) { return isCountMetric(r.metric); });
    var dailies = counts.filter(function (r) { return /^x_daily_post_count($|_)/.test(r.metric); });
    var cut = dailies.length ? dailies[dailies.length - 1].timestamp_utc : '';
    var pool = counts.filter(function (r) { return !cut || String(r.timestamp_utc || '') >= String(cut); });
    var row = null;
    pool.forEach(function (r) { row = row ? betterCount(row, r) : r; });
    var postRate = row ? perHourOf(row) : 0;
    var weibo = newestWeibo(rs);
    var weiboEq = weibo ? weibo.score : 0;
    var fullDailies = (rs || []).filter(function (r) {
      return r.metric === 'x_daily_post_count' && !/_to_\d{1,2}Z/i.test(String(r.source || ''));
    });
    var delta = null;
    if (row && row.metric === 'x_daily_post_count' && !/_to_\d{1,2}Z/i.test(String(row.source || '')) && fullDailies.length >= 2) {
      var prev = fullDailies[fullDailies.length - 2];
      if (prev && prev.timestamp_utc !== row.timestamp_utc) delta = row.value - prev.value;
    }
    if (weibo && weiboEq > 0 && weiboEq >= postRate) {
      return {
        row: weibo.row,
        kind: 'weibo',
        prev: null,
        delta: null,
        perHour: weiboEq,
        signalText: weibo.text,
        showValue: weibo.heat || weibo.rank
      };
    }
    if (row) {
      return {
        row: row,
        kind: 'posts',
        prev: null,
        delta: delta,
        perHour: postRate,
        signalText: rateText(postRate),
        showValue: Math.round(postRate * 10) / 10
      };
    }
    var views = (rs || []).filter(function (r) { return isViewMetric(r.metric); });
    if (views.length) {
      var viewRow = views[views.length - 1];
      views.forEach(function (r) { if ((r.timestamp_utc || '') >= (viewRow.timestamp_utc || '') && (+r.value || 0) > (+viewRow.value || 0)) viewRow = r; });
      return { row: viewRow, kind: 'views', prev: null, delta: null, perHour: 0, signalText: '代表帖浏览', showValue: +viewRow.value || 0 };
    }
    var last = rs && rs.length ? rs[rs.length - 1] : null;
    return { row: last, kind: 'other', prev: null, delta: null, perHour: 0, signalText: '', showValue: last ? +last.value || 0 : 0 };
  }
  function parseProgressMs(s) {
    var str = String(s || '').trim();
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!m) return 0;
    var hh = m[4] != null ? ('0' + m[4]).slice(-2) : '';
    if (hh) return Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + hh + ':' + m[5] + ':00Z') || 0;
    return Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T12:00:00Z') || 0;
  }
  function freshnessOf(topic, rs, cands, progress, asOf) {
    var marked = (rs || []).filter(function (r) { return r.metric === 'hours_since_last_progress'; });
    if (marked.length) {
      var h = +marked[marked.length - 1].value;
      if (isFinite(h)) return { hours: h, fresh: h <= FRONT_FRESH_H };
    }
    var p = progress && progress[topic];
    if (p) {
      if (p.no_progress_48h) {
        var ph = p.hours_since_last_progress_min;
        return { hours: ph == null || ph === '' ? 72 : +ph, fresh: false };
      }
      if (p.hours_since_last_progress_min != null && p.hours_since_last_progress_min !== '') {
        var h2 = +p.hours_since_last_progress_min;
        return { hours: h2, fresh: h2 <= FRONT_FRESH_H };
      }
      var lp = parseProgressMs(p.last_progress);
      if (lp && asOf) {
        var h3 = Math.max(0, (asOf - lp) / 3600000);
        return { hours: h3, fresh: h3 <= FRONT_FRESH_H };
      }
    }
    var id = matchTopic(topic, cands || []);
    var cand = null;
    (cands || []).forEach(function (c) { if (c && c.id === id) cand = c; });
    var ms = cand && (+cand.progressMs || +cand.time);
    if (ms && asOf) {
      var h4 = Math.max(0, (asOf - ms) / 3600000);
      return { hours: h4, fresh: h4 <= FRONT_FRESH_H };
    }
    return { hours: 24 * 30, fresh: false };
  }
  function annotateHeat(group, asOf) {
    var info = freshnessOf(group.t, group.rows, group.cands, group.progress, asOf);
    var stamp = group.last ? Date.parse(group.last.timestamp_utc) : 0;
    var measured = asOf && stamp ? Math.max(0, (asOf - stamp) / 3600000) : 24 * 30;
    group.hours = info.hours;
    group.fresh = !!info.fresh;
    var decay = Math.pow(0.5, measured / FRONT_HALF_H);
    group.score = (group.perHour || 0) * decay * (group.fresh ? 1 : 0.3);
    delete group.rows;
    delete group.cands;
    delete group.progress;
    return group;
  }
  function isBareDidiTopic(topic) {
    var t = String(topic || '').replace(/\s+/g, '');
    if (!/滴滴|didi/i.test(t)) return false;
    if (/恐同|价差|繁简|繁体|简体|罗萨里奥|凤凰|杀熟|投诉|司机/.test(t)) return false;
    if (t === '滴滴' || t === '滴滴&滴滴出海' || t === '滴滴＆滴滴出海') return true;
    if (/^滴滴(八卦关键词|海外市场|宽口径|巴西99)$/.test(t)) return true;
    if (/^滴滴(海外|出海|国内)/.test(t)) return true;
    if (/微博/.test(t) && /滴滴/.test(t)) return true;
    return false;
  }
  function isUnfilteredDidiRow(r) {
    if (!r || isBareDidiTopic(r.topic)) return false;
    if (!/滴滴|didi/i.test(String(r.topic || ''))) return false;
    var blob = String(r.metric || '') + ' ' + String(r.source || '');
    return /task_broad|name-collision|keyword-collision|noise|noisy|unfiltered|\braw\b|宽口径|未过滤|撞词|broad\/noisy|\bbroad\b/i.test(blob);
  }
  function storyTokens(topic) {
    var t = flatText(topic);
    var out = [];
    var seen = {};
    var latinStop = { deepseek: 1, nvidia: 1, openai: 1, anthropic: 1, bytedance: 1, google: 1, microsoft: 1 };
    (t.match(/[a-z][a-z0-9]{5,}/g) || []).forEach(function (w) {
      if (latinStop[w] || seen[w]) return;
      seen[w] = 1;
      out.push(w);
    });
    var n, i, sub, maxN = Math.min(t.length, 12);
    for (n = 6; n <= maxN; n++) {
      for (i = 0; i + n <= t.length; i++) {
        sub = t.slice(i, i + n);
        if (!/^[\u4e00-\u9fff]+$/.test(sub) || isGenericSlice(sub) || seen[sub]) continue;
        seen[sub] = 1;
        out.push(sub);
      }
    }
    return out;
  }
  function topicGroupsOf(heat, cands, opt) {
    var H = (heat || []).filter(function (r) {
      return r && !isBareDidiTopic(r.topic) && !isUnfilteredDidiRow(r);
    });
    if (!H.length) return [];
    opt = opt || {};
    var progress = opt.progress || {};
    var asOf = heatClock(H);
    var by = {};
    H.forEach(function (r) { (by[r.topic] = by[r.topic] || []).push(r); });
    return Object.keys(by).map(function (t) {
      var rs = by[t].slice().sort(function (a, b) { return a.timestamp_utc < b.timestamp_utc ? -1 : 1; });
      var sig = pickSignal(rs);
      return annotateHeat({
        t: t,
        last: sig.row,
        kind: sig.kind,
        delta: sig.delta,
        perHour: sig.perHour,
        signalText: sig.signalText,
        showValue: sig.showValue,
        pts: topicSeriesOf(t, H),
        rows: rs,
        cands: cands || [],
        progress: progress
      }, asOf);
    });
  }
  function heatKeyOf(topic, cands) {
    var list = cands || [];
    var id = matchTopic(topic, list);
    if (!id) return 'tp:' + normTopic(topic);
    var cand = null;
    list.forEach(function (c) { if (c && c.id === id) cand = c; });
    if (cand && sliceScore(topic, hayOf(cand), 4) > 0) return 'ev:' + id;
    return 'tp:' + normTopic(topic);
  }
  function preferHeatRow(a, b) {
    if (!!a.fresh !== !!b.fresh) return a.fresh ? a : b;
    return (b.score || 0) > (a.score || 0) ? b : a;
  }
  function dedupeHeatRows(rows, cands) {
    var list = rows || [];
    var parent = list.map(function (_, i) { return i; });
    function find(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    function unite(a, b) {
      var pa = find(a);
      var pb = find(b);
      if (pa !== pb) parent[pb] = pa;
    }
    var byKey = {};
    list.forEach(function (r, i) {
      var key = heatKeyOf(r.t, cands);
      if (byKey[key] != null) unite(byKey[key], i);
      else byKey[key] = i;
    });
    var tokAt = {};
    var tokN = {};
    list.forEach(function (r) {
      storyTokens(r.t).forEach(function (tok) { tokN[tok] = (tokN[tok] || 0) + 1; });
    });
    list.forEach(function (r, i) {
      storyTokens(r.t).forEach(function (tok) {
        if (tokN[tok] < 2 || tokN[tok] > 4) return;
        if (tokAt[tok] != null) unite(tokAt[tok], i);
        else tokAt[tok] = i;
      });
    });
    var groups = {};
    list.forEach(function (r, i) {
      var p = find(i);
      (groups[p] = groups[p] || []).push(r);
    });
    var out = Object.keys(groups).map(function (k) {
      var gs = groups[k];
      var keep = gs[0];
      gs.slice(1).forEach(function (other) {
        var winner = preferHeatRow(keep, other);
        var names = (winner.also || []).concat(keep.also || []).concat(other.also || []).concat([keep.t, other.t]);
        var seen = {};
        winner.also = names.filter(function (name) {
          if (!name || name === winner.t || seen[name]) return false;
          seen[name] = 1;
          return true;
        });
        keep = winner;
      });
      return keep;
    });
    return out.sort(function (a, b) {
      if (!!a.fresh !== !!b.fresh) return a.fresh ? -1 : 1;
      return (b.score || 0) - (a.score || 0);
    });
  }
  function rankHeat(heat, cands, opt) {
    return dedupeHeatRows(topicGroupsOf(heat, cands, opt), cands).slice(0, 10);
  }
  function shortHeat(heat, cands, shortterm, opt) {
    var seen = {};
    rankHeat(heat, cands, opt).forEach(function (r) { seen[heatKeyOf(r.t, cands)] = 1; });
    var out = [];
    (shortterm || []).forEach(function (t) {
      var key = heatKeyOf(t.name, cands);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(t);
    });
    return out;
  }
  function auditHeat(input) {
    input = input || {};
    var heat = input.heat || [];
    var cands = input.cands || [];
    var posts = input.posts || {};
    var items = input.items || [];
    var byId = {};
    items.forEach(function (it) { if (it && it.id) byId[it.id] = it; });
    var topics = rankHeat(heat, cands).map(function (r) { return { topic: r.t, also: r.also || [] }; });
    shortHeat(heat, cands, input.shortterm || []).forEach(function (t) { topics.push({ topic: t.name, also: [] }); });
    var fails = [];
    var reports = [];
    topics.forEach(function (row) {
      var seen = {};
      var samples = [];
      [row.topic].concat(row.also || []).forEach(function (name) {
        heatSamples(name, heat, posts, items).forEach(function (p) {
          var id = xId(p.url);
          if (!id || seen[id]) return;
          seen[id] = 1;
          samples.push(p);
        });
      });
      var eventId = matchTopic(row.topic, cands);
      var it = eventId && byId[eventId];
      if (it && isStatusStub(it)) it = null;
      if (it) {
        sourcesOf(it, posts).forEach(function (s) {
          var id = xId(s.url) || s.url;
          if (!id || seen[id]) return;
          seen[id] = 1;
          samples.push(s);
        });
      } else if (/滴滴|didi|99app/i.test(String(row.topic || ''))) {
        reports.push({ topic: row.topic, n: 1, reason: '', about: '', kind: 'didi' });
        return;
      }
      samples = orderPosts(samples);
      var usable = samples.filter(function (p) {
        return String(p.text || '').trim() || String(p.translation_zh || '').trim() || p.status === 'unavailable';
      });
      var reason = heatEmptyReason(row.topic, usable, heat);
      var about = heatAbout(usable);
      reports.push({ topic: row.topic, n: usable.length, reason: reason, about: about });
      if (!usable.length && !reason) fails.push('热榜 popup has no posts and no reason: ' + row.topic);
    });
    return { fails: fails, reports: reports };
  }

  return {
    FOLD_X: FOLD_X,
    FOLD_SUM: FOLD_SUM,
    MISS: MISS,
    UNAVAIL: UNAVAIL,
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
    FRONT_HALF_H: FRONT_HALF_H,
    FRONT_FRESH_H: FRONT_FRESH_H,
    frontScore: frontScore,
    matchTopic: matchTopic,
    trackerName: trackerName,
    displayLabel: displayLabel,
    placeTag: placeTag,
    didiTimeline: didiTimeline,
    itemSortDate: itemSortDate,
    orderPosts: orderPosts,
    heatSamples: heatSamples,
    heatAbout: heatAbout,
    heatEmptyReason: heatEmptyReason,
    topicSeries: topicSeriesOf,
    topicGroups: topicGroupsOf,
    heatKeyOf: heatKeyOf,
    dedupeHeatRows: dedupeHeatRows,
    rankHeat: rankHeat,
    shortHeat: shortHeat,
    auditHeat: auditHeat
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
