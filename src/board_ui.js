/* UX layer: heat explanation, time spans, event overlay, X cache, mobile shell.
   Depends on globals from dashboard_template.html (D, ITEMS, $, esc, fmt, fmtTs, parseTs, fmtHeatDay, state, paintHeader, paintTz, TZKEY, tzMode, isRide, focusPanel, timeline, ridePanel, hl, match, MAXV, TYPES). */
(function () {
  if (!window.PostUI) throw new Error('post_ui.js missing');
  PostUI.bind(document);
  let openId = null;
  let returnEl = null;
  let mtab = 'feed';
  let ptab = 'home';
  const PROMO_KEY = 'gossipPromo';
  const HIDE_KEY = 'gossipHide';

  function xId(url) {
    const m = String(url || '').match(/status\/(\d+)/);
    return m ? m[1] : '';
  }
  function xSnap(url) {
    const id = xId(url);
    const posts = (D.x_cache && D.x_cache.posts) || {};
    return (id && posts[id]) || null;
  }
  function firstX(it) {
    const d = it.detail || {};
    for (const p of d.x_posts || []) if (xId(p.url)) return p;
    for (const l of it.links || []) if (xId(l.url)) return { url: l.url, views: l.views, author: l.label };
    for (const c of d.comments || []) if (xId(c.url)) return { url: c.url, text: c.text, author: c.author };
    return null;
  }
  function allX(it) {
    const d = it.detail || {};
    const out = [], seen = new Set();
    function add(url, extra) {
      const id = xId(url);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(Object.assign({ url: url }, extra || {}));
    }
    (d.x_posts || []).forEach(p => add(p.url, p));
    (it.links || []).forEach(l => add(l.url, { views: l.views, author: l.label }));
    (d.comments || []).forEach(c => add(c.url, { text: c.text, author: c.author }));
    return out;
  }
  function posts() {
    return (D.x_cache && D.x_cache.posts) || {};
  }
  function didiName() {
    return PostUI.trackerName(D.longterm);
  }
  function displayLabel(s) {
    return PostUI.displayLabel(s, didiName());
  }
  function didiItems() {
    return ITEMS.filter(matchesDidi).map(function (it) {
      const e = it._e || {};
      return Object.assign({}, it, { section: it._sec || it.section || '', edition_date: e.edition_date || e.timestamp || '', edition_ts: e.timestamp || '' });
    });
  }
  function itemOrig(it) {
    return PostUI.origBlock(PostUI.primaryOf(it, posts()), { clamp: true, formatTime: fmtTs });
  }
  function allOrig(it) {
    return PostUI.sourcesOf(it, posts()).map(s => PostUI.origBlock(s, { clamp: true, formatTime: fmtTs })).join('');
  }
  function foldable(cls, html) {
    return PostUI.foldable(cls, html);
  }
  function wireClamps(root) {
    PostUI.wireClamps(root);
  }
  const SPAN_TIP = '起=已有信号里最早的钟点；没有钟点就用条目上的日期。采=内容采集或整理里最晚的钟点（帖子指标抓取、enriched_at、趋势抓取）。正文缓存的抓取时间只有在没有更早采集点时才顶上，否则用看板生成时间。';
  function eventSpan(it) {
    const d = it.detail || {};
    const starts = [], asofs = [], cacheAs = [];
    (d.timeline || []).forEach(t => { if (parseTs(t.date)) starts.push(t.date); });
    (d.x_posts || []).forEach(p => {
      if (parseTs(p.created_at)) starts.push(p.created_at);
      if (parseTs(p.fetched_at)) asofs.push(p.fetched_at);
    });
    allX(it).forEach(x => {
      const s = xSnap(x.url);
      if (s && parseTs(s.created_at)) starts.push(s.created_at);
      if (s && parseTs(s.fetched_at)) cacheAs.push(s.fetched_at);
    });
    if (parseTs(d.enriched_at)) asofs.push(d.enriched_at);
    if (d.x_trend && parseTs(d.x_trend.fetched_at)) asofs.push(d.x_trend.fetched_at);
    starts.sort((a, b) => parseTs(a) - parseTs(b));
    asofs.sort((a, b) => parseTs(a) - parseTs(b));
    cacheAs.sort((a, b) => parseTs(a) - parseTs(b));
    const start = starts[0] || it.date || '';
    const asof = asofs[asofs.length - 1] || cacheAs[cacheAs.length - 1] || D.built || '';
    if (!start && !asof) return '';
    return `起 ${fmtTs(start)} → 采 ${fmtTs(asof)}`;
  }
  function heatExplain() {
    const H = D.heat || [];
    const stamps = H.map(r => r.timestamp_utc).filter(Boolean).sort();
    const asof = stamps.length ? fmtTs(stamps[stamps.length - 1]) : '未知';
    const dailyN = H.filter(r => r.metric === 'x_daily_post_count').length;
    return `<div class="heat-how"><div class="heat-head"><b>热度怎么算</b><button type="button" class="xmore heat-toggle" aria-expanded="false">展开</button></div>
<p class="heat-brief">热度榜按 heat_log 里该话题最近完整 UTC 日的 X 发帖量排序；卡片「浏览」是另一套链接浏览量。</p>
<div class="heat-full">
<p>热度榜以 heat_log 里<strong>最近一条记录的时间</strong>当作最近一期。先排最近 48 小时内有记录的话题，再排更早的。有完整日发帖量的，用最近一个完整 UTC 日的发帖量；没有日发帖、但有窗口或小时发帖计数的，用最新一条发帖计数；只有代表帖浏览的，才用浏览量，并且排在有发帖计数的话题后面。数字从该条记录的时间算到最近一期，乘 36 小时半衰期。超过 48 小时的旧浏览不能压过新话题。日发帖量持平或下降、并且已经超过 48 小时的，再乘 0.5。近 48 小时里日发帖量在升的，乘 1.25。</p>
<p>折线按时间排同一指标。图上有纵轴刻度、每个点的精确值，以及最后两个完整日的差额。名字里带 partial 的是采集截止前的未完成日，只补在图末尾，<strong>不参与排名</strong>。</p>
<p>卡片上的「浏览」是另一套数：该条链接和缓存帖浏览量的最大值（万/亿/k/M）。≥10 万标「爆」，≥1 万标「热」。条宽用相对最大值的平方根，避免头部把其余挤没。</p>
<p>头版另算，时间也锚在最近一期，不看页面生成时间。头瓜必须是最后进展落在 48 小时内、衰减后最高的一条。最近一期里的报道，不必手工标记追踪，也会进头版。热度优先用链接、缓存和 heat_log 代表帖的浏览量；没有浏览量就用发帖计数；都没有就按时间新旧。48 小时内一条都没有时，头版改显示时间上最新的几条，不再把过期旧闻排到前面。</p>
<p>topics.md 里的「热度：待更新」是编辑备注，不是算出来的。这份快照有 ${H.length} 条热度记录（日发帖 ${dailyN} 条），最新时间 ${esc(asof)}。榜单不会自己滚，要更新得重新采集、追加 csv，再跑构建。</p>
</div></div>`;
  }
  function topicSeries(topic) {
    return PostUI.topicSeries(topic, D.heat);
  }
  function topicGroups() {
    return PostUI.topicGroups(D.heat);
  }
  function heatCands() {
    return ITEMS.map(it => {
      const d = it.detail || {};
      return {
        id: it.id,
        title: d.title || '',
        company: it.company || '',
        blob: (it.company || '') + ' ' + (d.title || '') + ' ' + (it.text || ''),
        rich: !!(d.title || (d.timeline && d.timeline.length))
      };
    });
  }
  function heatKey(topic) {
    return PostUI.heatKeyOf(topic, heatCands());
  }
  function dedupeHeat(rows) {
    return PostUI.dedupeHeatRows(rows, heatCands());
  }
  let rankCache = null;
  function rankRows() {
    if (!rankCache) rankCache = PostUI.rankHeat(D.heat, heatCands());
    return rankCache;
  }
  function heatMetricLabel(metric) {
    const m = String(metric || '');
    if (m === 'x_daily_post_count') return 'X 日发帖';
    if (m.indexOf('partial') >= 0) return '未完结发帖';
    if (m.indexOf('hour') >= 0) return '小时发帖';
    if (m.indexOf('x_posts_') === 0 || m.indexOf('post_count') >= 0) return '窗口发帖';
    if (m === 'x_sample_post' || m.indexOf('views') >= 0) return '代表帖浏览';
    if (m.indexOf('weibo') >= 0) return '微博热度';
    return m;
  }
  function shortList() {
    return PostUI.shortHeat(D.heat, heatCands(), D.shortterm);
  }
  function overlayPosts(it) {
    const seen = {};
    const out = [];
    function add(p) {
      if (!p) return;
      const id = xId(p.url);
      const key = id || p.url || ('t:' + String(p.text || '').slice(0, 40));
      if (!key || seen[key]) return;
      if (!p.url && !String(p.text || '').trim() && !p.translation_zh && p.status !== 'unavailable') return;
      seen[key] = 1;
      out.push(p);
    }
    PostUI.sourcesOf(it, posts()).forEach(add);
    const names = {};
    (D.heat || []).forEach(r => { names[r.topic] = 1; });
    Object.keys(names).forEach(topic => {
      if (PostUI.matchTopic(topic, heatCands()) !== it.id) return;
      PostUI.heatSamples(topic, D.heat, posts(), ITEMS).forEach(add);
    });
    return PostUI.orderPosts(out);
  }
  function aboutHtml(list) {
    const line = PostUI.heatAbout(list);
    if (!line) return '';
    return '<p class="psum heat-about"><b>这是在说什么</b> ' + esc(line) + '</p>';
  }
  function postsHtml(list) {
    return (list || []).map(p => PostUI.origBlock(p, { clamp: true, formatTime: fmtTs })).join('');
  }
  function axisLabel(p) {
    if (!parseTs(p.t)) return String(p.t || '').replace('*', '');
    const day = fmtHeatDay(p.t);
    return p.partial ? day.slice(5, 16) : day.slice(5);
  }
  function trendChart(pts) {
    if (!pts || !pts.length) return '<p class="empty">这个话题在 heat_log 里还没有序列。</p>';
    const w = 560, h = 168, pl = 52, pr = 10, pt = 18, pb = 32;
    const iw = w - pl - pr, ih = h - pt - pb;
    const max = Math.max.apply(null, pts.map(p => p.v).concat([1]));
    const y = v => pt + ih - (v / max) * ih;
    const x = i => pl + (pts.length === 1 ? iw / 2 : i / (pts.length - 1) * iw);
    const ticks = [0, max / 2, max];
    const grid = ticks.map(tv => `<line x1="${pl}" y1="${y(tv).toFixed(1)}" x2="${w - pr}" y2="${y(tv).toFixed(1)}" stroke="var(--line)"></line><text x="${pl - 4}" y="${(y(tv) + 3).toFixed(1)}" text-anchor="end" class="ax">${esc(fmt(tv))}</text>`).join('');
    const poly = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const dots = pts.map((p, i) => {
      const tip = `${axisLabel(p)} · ${fmt(p.v)}${p.partial ? '（未完结，不参与排名）' : ''}`;
      return `<g class="pt" tabindex="0" data-tip="${esc(tip)}"><circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5" fill="${p.partial ? 'var(--warn)' : 'var(--acc)'}"></circle><text class="pv" x="${x(i).toFixed(1)}" y="${(y(p.v) - 7).toFixed(1)}" text-anchor="middle">${esc(fmt(p.v))}</text><title>${esc(tip)}</title></g>`;
    }).join('');
    const xlab = pts.map((p, i) => `<text class="xl" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(axisLabel(p))}</text>`).join('');
    const completes = pts.filter(p => !p.partial);
    let note = '';
    if (completes.length >= 2) {
      const a = completes[completes.length - 1], b = completes[completes.length - 2];
      const d = a.v - b.v;
      note = `完整日 ${fmt(a.v)}，较前一日 ${d > 0 ? '+' : ''}${fmt(d)}`;
    } else if (pts.length) note = `当前 ${fmt(pts[pts.length - 1].v)}`;
    if (pts.some(p => p.partial)) note += (note ? ' · ' : '') + `未完结 ${fmt(pts.filter(p => p.partial).pop().v)}`;
    return `<div class="tchart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(note)}">${grid}<polyline points="${poly}" fill="none" stroke="var(--acc)" stroke-width="2.5"></polyline>${dots}${xlab}</svg><div class="tdelta">${esc(note)}</div><div class="ttip" hidden></div></div>`;
  }
  function showTip(g) {
    const box = g.closest('.tchart').querySelector('.ttip');
    if (!box) return;
    box.hidden = false;
    box.textContent = g.getAttribute('data-tip') || '';
  }

  const TITLE_SPLIT = /大模型|负责人|结构性|委员会|众议院|特别|争议|断裂|支架|踏板|刹车|销售|下滑|线上|大幅|个月|晋升|点名|关联|美国|中国|对华|事件|公司|汽车|热搜|高管|离职|唯一|不做|赴港|和解|索赔/;
  function nameTokens(title, company) {
    const bag = [];
    String(company || '').split(/[·/、|，,\s]+/).forEach(p => {
      if (p.length >= 2 && p.length <= 12) bag.push(p);
    });
    const t = String(title || '');
    (t.match(/[A-Za-z][A-Za-z0-9]{1,11}/g) || []).forEach(w => bag.push(w));
    (t.match(/[“"「]([^”"」]{2,12})[”"」]/g) || []).forEach(q => bag.push(q.replace(/[“"「」”]/g, '')));
    t.split(/[^\u4e00-\u9fff]+/).forEach(ch => {
      if (!ch) return;
      ch.split(TITLE_SPLIT).forEach(p => {
        if (p.length >= 2 && p.length <= 8) bag.push(p);
      });
    });
    return bag;
  }
  function parentEvent(it) {
    if ((it.detail || {}).title) return null;
    const idx = ITEMS.indexOf(it);
    let parent = null;
    for (let i = idx - 1; i >= 0; i--) {
      const prev = ITEMS[i];
      if (prev._e !== it._e || prev._sec !== it._sec) break;
      if ((prev.detail || {}).title) { parent = prev; break; }
    }
    if (!parent) return null;
    const co = String(it.company || '');
    const text = String(it.text || '');
    const hit = nameTokens(parent.detail.title, parent.company).some(tok => tok && co.indexOf(tok) < 0 && text.indexOf(tok) >= 0);
    return hit ? parent : null;
  }
  function headline(it) {
    const text = String(it.text || '').trim();
    const colon = text.split(/[：:]/);
    let body = text;
    if (colon.length > 1) {
      const h = colon[0].trim();
      if (h.length >= 8 && h.length <= 42 && h.length < text.length) return h;
      if (h.length < 8) body = colon.slice(1).join('：').trim() || text;
    }
    const clause = body.split(/[，。；]/)[0].trim();
    if (clause.length >= 8 && clause.length <= 42 && clause.length < text.length) return clause;
    const company = String(it.company || '').trim();
    if (company && company.length < text.length) return company;
    return text.slice(0, 18);
  }
  function itemStory(it) {
    const d = it.detail || {};
    const parent = parentEvent(it);
    const title = displayLabel(d.title || (parent ? parent.detail.title : headline(it)));
    const sum = d.summary || it.text || '';
    return { title: title, parent: parent, sum: sum, kicker: d.summary ? '摘要' : '条目摘要', fx: firstX(it) };
  }
  function storyBlock(it, withTitle) {
    const s = itemStory(it);
    const head = withTitle ? `${s.parent ? '<span class="prog">事件进展</span>' : ''}<h3 class="evtitle">${hl(s.title)}</h3>` : '';
    return `${head}<div class="kicker">${s.kicker}</div>${foldable('sum', hl(s.sum))}<div class="kicker">原文</div>${itemOrig(it)}`;
  }
  function linksHtml(it) {
    return (it.links || []).map(l => {
      const known = PostUI.platform(l.url);
      return `<div class="linkrow">${known ? '' : '🔗 '}${PostUI.extLink(l.url, hl(l.label), { html: true })}${l.views ? `<span class="vw">👁 ${esc(l.views)}</span>` : ''}</div>`;
    }).join('');
  }
  function card(it) {
    const e = it._e;
    const badge = it._views >= 1e5 ? '爆' : it._views >= 1e4 ? '热' : '';
    return `<article class="card" data-id="${esc(it.id)}" style="--c:${it._col}"><div class="heatbar">${it._views ? `<b>${fmt(it._views)}</b> 浏览${badge ? `<span class="hotb">${badge}</span>` : ''}<div class="hbar"><i style="width:${(Math.sqrt(it._views / MAXV) * 100).toFixed(1)}%"></i></div>` : '<span>暂无浏览数据</span>'}</div><div class="top"><span class="pill">${hl(displayLabel(it.company))}</span>${it.detail ? '<span class="rich">深度</span>' : ''}
<span class="badge ${it.tag === '实锤' ? 'b-real' : 'b-rum'}">【${esc(it.tag)}】</span>${(it.source_types || []).map(s => `<span class="src">${esc(s)}</span>`).join('')}<span class="date spanline" title="${esc(SPAN_TIP)}">${esc(eventSpan(it))}</span></div>
<div class="secn">${esc(TYPES[e.type] || e.type)} · ${esc(displayLabel(it._sec))} ${it._views ? `<span class="hbadge" title="浏览=该条链接里最高浏览量，不是热度榜的日发帖量。≥10万爆，≥1万热。">${fmt(it._views)} 浏览${badge ? ' ' + badge : ''}</span> <span class="note">按该条链接最高浏览量</span>` : '<span class="note">这条没有浏览量</span>'}</div>${storyBlock(it, true)}
<button type="button" class="more open-ev" data-id="${esc(it.id)}">查看事件详情</button><div class="links">${linksHtml(it)}</div></article>`;
  }
  function renderHero() {
    if (state.type === 'ride') {
      const L = ITEMS.filter(isRide).slice(0, 3);
      $('#herolbl').textContent = L.length ? `网约车匹配 ${ITEMS.filter(isRide).length} 条` : '';
      const grads = ['linear-gradient(135deg,#ff6b4a,#c2185b)', 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'linear-gradient(135deg,#0ea5e9,#0d9488)'];
      $('#hero').innerHTML = L.length ? L.map((it, i) => `<div class="herocard" style="background:${grads[i]}"><div class="big">${i + 1}</div><div class="co">${esc(displayLabel(it.company))}</div><div class="ed spanline">${esc(eventSpan(it))}</div><p>${esc(it.text)}</p>${itemOrig(it)}<button type="button" class="more open-ev" data-id="${esc(it.id)}" style="color:#fff">事件详情</button></div>`).join('') : '<p class="empty">暂无滴滴相关条目，随快讯更新</p>';
      return;
    }
    const eds = D.editions.filter(e => !state.type || e.type === state.type);
    const e = eds[0];
    if (!e || !e.top3) { $('#hero').innerHTML = '<p class="empty">该分类暂无期次。</p>'; $('#herolbl').textContent = ''; return; }
    $('#herolbl').textContent = `来自 ${fmtTs(e.edition_date || e.timestamp)} · ${TYPES[e.type] || e.type}`;
    const grads = ['linear-gradient(135deg,#ff6b4a,#c2185b)', 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'linear-gradient(135deg,#0ea5e9,#0d9488)'];
    $('#hero').innerHTML = e.top3.slice(0, 3).map((t, i) => {
      const s = e.sections.find(x => x.title === t.section);
      const it = s && s.items[t.index];
      if (!it) return '';
      return `<div class="herocard" style="background:${grads[i]}"><div class="big">${i + 1}</div><div class="co">${esc(displayLabel(it.company))}</div><div class="ed spanline">${esc(eventSpan(it))}</div><p>${esc(it.text)}</p>${itemOrig(it)}<button type="button" class="more open-ev" data-id="${esc(it.id)}" style="color:#fff">事件详情</button></div>`;
    }).join('');
  }
  function heatPanel() {
    const rows = rankRows();
    if (rows.length) {
      const ol = rows.map((r, i) => {
        const d = r.delta;
        const ds = d == null ? '' : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${fmt(d)} 较前一日</span>`;
        return `<li class="rankrow"><button type="button" class="open-ev heat-hit" data-id="${esc(heatOpenId(r.t))}"><span class="no">${i + 1}</span><div class="t"><b>${esc(displayLabel(r.t))}</b><div class="note">${esc(heatMetricLabel(r.last.metric))} · ${esc(fmtHeatDay(r.last.timestamp_utc))}${r.fresh ? '' : ' · 已超过 48 小时'} ${ds}</div></div><span class="v">${fmt(r.last.value)}</span></button>${trendChart(r.pts)}</li>`;
      }).join('');
      $('#heat').innerHTML = heatExplain() + `<ol class="rank">${ol}</ol>`;
      return;
    }
    const L = ITEMS.filter(i => i._views > 0).sort((a, b) => b._views - a._views).slice(0, 10);
    $('#heat').innerHTML = heatExplain() + `<p class="note">heat_log.csv 暂无数据，下面临时按条目链接最高浏览量排，没有日序列。</p><ol class="rank">${L.map((it, i) => `<li class="rankrow"><button type="button" class="open-ev heat-hit" data-id="${esc(it.id)}"><span class="no">${i + 1}</span><span class="t"><b>${esc(displayLabel(it.company))}</b> · ${esc(it.text.slice(0, 22))}…</span><span class="v">👁 ${fmt(it._views)}</span></button></li>`).join('')}</ol>`;
  }
  function shortPanel() {
    const blocks = shortList().map(t => `<div class="hot"><button type="button" class="open-ev heat-hit" data-id="${esc(heatOpenId(t.name))}"><b>${esc(displayLabel(t.name))}</b><div class="r">${esc(t.reason)}</div><div class="note">编辑备注「热度：${esc(t.heat)}」不是公式结果 · ${esc(t.status)} · 加入 ${esc(fmtTs(t.added))}</div></button>${trendChart(topicSeries(t.name))}</div>`).join('');
    $('#short').innerHTML = heatExplain() + (blocks || '<p class="empty">topics.md 中暂无短期热点</p>');
  }
  function loadIds(key) {
    try {
      const a = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(a) ? a : []);
    } catch (e) { return new Set(); }
  }
  function saveIds(key, set) {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  function explicitTrack(it) {
    const d = it.detail || {};
    return it.track === true || d.track === true || !!(it.event_id || d.event_id);
  }
  function normUrl(u) {
    const raw = String(u || '').trim();
    if (!raw) return '';
    try {
      const x = new URL(raw);
      const path = x.pathname.replace(/\/+$/, '');
      if (path.split('/').filter(Boolean).length < 2) return '';
      return (x.host + path).toLowerCase();
    } catch (e) {
      return '';
    }
  }
  function itemUrls(it) {
    const out = [];
    const seen = new Set();
    (it.links || []).forEach(l => {
      const n = normUrl(l && l.url);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out;
  }
  function titledByUrl() {
    const map = new Map();
    ITEMS.forEach(it => {
      if (!((it.detail || {}).title)) return;
      itemUrls(it).forEach(u => {
        const cur = map.get(u);
        if (!cur) { map.set(u, it); return; }
        const an = ((it.detail || {}).timeline || []).length;
        const bn = ((cur.detail || {}).timeline || []).length;
        if (an > bn || (an === bn && (it._views || 0) > (cur._views || 0))) map.set(u, it);
      });
    });
    return map;
  }
  function rootOf(it) {
    const d = it.detail || {};
    const eid = it.event_id || d.event_id;
    if (eid) {
      const same = ITEMS.filter(x => (x.event_id || (x.detail || {}).event_id) === eid);
      const titled = same.find(x => (x.detail || {}).title);
      const hit = titled || same[0];
      if (hit && hit !== it) return hit;
    }
    if (d.title || explicitTrack(it)) return null;
    const byUrl = titledByUrl();
    const linked = itemUrls(it).map(u => byUrl.get(u)).find(hit => hit && hit !== it);
    if (linked) return linked;
    const p = parentEvent(it);
    if (p && ((p.detail || {}).title || explicitTrack(p))) return p;
    return null;
  }
  function linkViews(it) {
    let m = it._views || 0;
    function take(url, views) {
      m = Math.max(m, PostUI.parseViews(views));
      const snap = xSnap(url);
      if (snap) m = Math.max(m, PostUI.parseViews(snap.views));
    }
    (it.links || []).forEach(l => take(l && l.url, l && l.views));
    const d = it.detail || {};
    (d.x_posts || []).forEach(p => take(p && p.url, p && p.views));
    return m;
  }
  function groupUrls(g) {
    const urls = new Set();
    [g.root].concat(g.members || []).forEach(it => {
      itemUrls(it).forEach(u => urls.add(u));
    });
    return urls;
  }
  function groupHeat(g) {
    const urls = groupUrls(g);
    let views = Math.max(linkViews(g.root), 0);
    (g.members || []).forEach(m => { views = Math.max(views, linkViews(m)); });
    const topics = new Set();
    (D.heat || []).forEach(r => {
      const n = normUrl(r.source);
      if (!n || !urls.has(n)) return;
      topics.add(r.topic);
      if (r.metric === 'x_sample_post' || String(r.metric || '').indexOf('views') >= 0) views = Math.max(views, +r.value || 0);
    });
    let posts = 0;
    if (topics.size) {
      rankRows().forEach(row => {
        if (topics.has(row.t) || (row.also || []).some(name => topics.has(name))) {
          if (row.kind === 'posts') posts = Math.max(posts, row.last && row.last.value || 0);
        }
      });
    }
    return { views: views, posts: posts };
  }
  function groupViews(g) {
    return groupHeat(g).views;
  }
  function asOfMs() {
    let best = 0;
    (D.editions || []).forEach(e => {
      const t = parseTs(e.timestamp) || parseTs(e.edition_date);
      if (t && t.getTime() > best) best = t.getTime();
    });
    if (best) return best;
    const built = parseTs(D.built);
    return built ? built.getTime() : Date.now();
  }
  function stampList(s, editionDate) {
    const str = String(s || '').trim();
    if (!str) return [];
    const direct = parseTs(str);
    if (direct) return [direct.getTime()];
    const out = [];
    const yearRe = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/g;
    let m;
    let dated = false;
    while ((m = yearRe.exec(str))) {
      dated = true;
      if (m[4] != null) out.push(Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00Z'));
      else out.push(Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T15:59:00Z'));
    }
    if (!dated) {
      const year = String(editionDate || '').match(/\d{4}/);
      const y = year ? year[0] : '';
      if (y) {
        const md = /(\d{1,2})-(\d{1,2})(?:\/(\d{1,2}))?(?:[ T](\d{1,2}):(\d{2}))?/g;
        while ((m = md.exec(str))) {
          const mo = ('0' + m[1]).slice(-2);
          const days = m[3] ? [m[2], m[3]] : [m[2]];
          days.forEach(day => {
            const dd = ('0' + day).slice(-2);
            if (+m[1] < 1 || +m[1] > 12 || +day < 1 || +day > 31) return;
            if (!m[3] && m[4] != null) out.push(Date.parse(y + '-' + mo + '-' + dd + 'T' + ('0' + m[4]).slice(-2) + ':' + m[5] + ':00+08:00'));
            else out.push(Date.parse(y + '-' + mo + '-' + dd + 'T15:59:00Z'));
          });
        }
      }
    }
    return out.filter(ms => ms && !isNaN(ms));
  }
  function stampMs(s, editionDate) {
    const all = stampList(s, editionDate);
    if (!all.length) return null;
    return Math.max.apply(null, all);
  }
  function progressMs(g) {
    const times = [];
    function take(it) {
      if (!it) return;
      const ed = (it._e && (it._e.edition_date || it._e.timestamp)) || '';
      const d = it.detail || {};
      [it.date].concat((d.timeline || []).map(t => t.date), (d.x_posts || []).map(p => p.created_at)).forEach(s => {
        stampList(s, ed).forEach(ms => times.push(ms));
      });
    }
    take(g.root);
    (g.members || []).forEach(take);
    if (!times.length) {
      const edition = parseTs(g.root._e && g.root._e.timestamp);
      return edition ? edition.getTime() : null;
    }
    return Math.max.apply(null, times);
  }
  function eventHours(g) {
    const p = progressMs(g);
    if (p == null) return 24 * 30;
    return Math.max(0, (asOfMs() - p) / 3600000);
  }
  function eventDelta(g) {
    const rank = matchedRank(g.root);
    return rank ? rank.delta : null;
  }
  function eventScore(g) {
    const heat = groupHeat(g);
    const signal = heat.views > 0 ? heat.views : (heat.posts > 0 ? heat.posts : 1);
    return PostUI.frontScore(signal, eventHours(g), eventDelta(g));
  }
  function editionFresh(it) {
    const t = parseTs(it._e && it._e.timestamp) || parseTs(it._e && it._e.edition_date);
    if (!t) return false;
    const gap = asOfMs() - t.getTime();
    return gap >= -3600000 && gap <= PostUI.FRONT_FRESH_H * 3600000;
  }
  function isRoundup(it) {
    return String(it._sec || it.section || '').indexOf('重点追踪') >= 0;
  }
  function isStubText(it) {
    const text = String(it.text || '').trim();
    return text.indexOf('本期无新动态') === 0 || text.indexOf('本期无重大新动态') === 0 || text.indexOf('本期有新动态') === 0 || text.indexOf('本期无警报') === 0;
  }
  function autoFront(it) {
    return editionFresh(it) && !isStubText(it) && !isRoundup(it);
  }
  function clusters() {
    const promo = loadIds(PROMO_KEY);
    const hide = loadIds(HIDE_KEY);
    const membersOf = new Map();
    ITEMS.forEach(it => {
      const r = rootOf(it);
      if (!r) return;
      if (!membersOf.has(r.id)) membersOf.set(r.id, []);
      membersOf.get(r.id).push(it);
    });
    const events = [];
    const seen = new Set();
    ITEMS.forEach(it => {
      if (rootOf(it)) return;
      const tracked = !!((it.detail || {}).title) || explicitTrack(it) || promo.has(it.id) || autoFront(it);
      if (!tracked || seen.has(it.id)) return;
      seen.add(it.id);
      events.push({ root: it, members: membersOf.get(it.id) || [] });
    });
    const merged = mergeByUrl(events);
    merged.sort((a, b) => eventScore(b) - eventScore(a) || groupViews(b) - groupViews(a));
    const leads = dedupeLeads(ITEMS.filter(it => {
      if (rootOf(it)) return false;
      if ((it.detail || {}).title || explicitTrack(it) || promo.has(it.id) || autoFront(it)) return false;
      if (hide.has(it.id) || isRoundup(it) || isStubText(it)) return false;
      return match(it);
    }).sort((a, b) => (editionFresh(b) - editionFresh(a)) || ((parseTs(b._e && b._e.timestamp) || 0) - (parseTs(a._e && a._e.timestamp) || 0)) || ((b._views || 0) - (a._views || 0))));
    const shown = merged.filter(g => match(g.root) || g.members.some(match));
    return { events: shown, leads: leads };
  }
  function mergeByUrl(events) {
    const parent = events.map((_, i) => i);
    function find(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    const byUrl = new Map();
    events.forEach((g, i) => {
      itemUrls(g.root).forEach(u => {
        if (!byUrl.has(u)) byUrl.set(u, i);
        else parent[find(i)] = find(byUrl.get(u));
      });
    });
    const groups = new Map();
    events.forEach((g, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(g);
    });
    const out = [];
    groups.forEach(gs => {
      gs.sort((a, b) => eventScore(b) - eventScore(a) || groupViews(b) - groupViews(a) || ((b.root.detail || {}).timeline || []).length - ((a.root.detail || {}).timeline || []).length);
      const win = gs[0];
      const seen = new Set([win.root.id]);
      const members = (win.members || []).slice();
      gs.slice(1).forEach(g => {
        members.push(g.root);
        (g.members || []).forEach(m => members.push(m));
      });
      win.members = members.filter(m => {
        if (!m || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      out.push(win);
    });
    return out;
  }
  function dedupeLeads(rows) {
    const seenId = new Set();
    const seenUrl = new Set();
    const out = [];
    rows.forEach(it => {
      if (seenId.has(it.id)) return;
      const urls = itemUrls(it);
      if (urls.some(u => seenUrl.has(u))) return;
      seenId.add(it.id);
      urls.forEach(u => seenUrl.add(u));
      out.push(it);
    });
    return out;
  }
  function nodeTime(s) {
    if (!s) return null;
    const d = parseTs(s);
    if (d) return d.getTime();
    const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
    return null;
  }
  function editionLine() {
    const e = (D.editions && D.editions[0]) || {};
    const raw = String(e.edition_date || e.timestamp || '');
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { date: '', issue: '' };
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const start = Date.UTC(+m[1], 0, 0);
    const day = Math.round((dt.getTime() - start) / 86400000);
    const clock = fmtTs(D.built);
    const hm = (clock.match(/(\d{2}:\d{2})/) || [])[1] || '';
    return {
      date: m[1] + '.' + m[2] + '.' + m[3] + ' ' + weeks[dt.getUTCDay()],
      issue: (day > 0 ? '第' + day + '期 · ' : '') + '每天 5 次更新' + (hm ? ' · ' + hm : '')
    };
  }
  function latestProg(g) {
    const tl = ((g.root.detail || {}).timeline || []).map((t, i) => ({ date: t.date, text: t.text, i: i }));
    if (tl.length) {
      tl.sort((a, b) => (nodeTime(b.date) || 0) - (nodeTime(a.date) || 0) || b.i - a.i);
      return tl[0];
    }
    if (g.members.length) {
      const m = g.members[g.members.length - 1];
      return { date: m.date, text: m.text };
    }
    return null;
  }
  function isFresh(g) {
    return eventHours(g) <= PostUI.FRONT_FRESH_H;
  }
  function matchedRank(it) {
    const title = ((it.detail || {}).title || '') + (it.company || '');
    return rankRows().find(r => {
      const brand = (String(r.t).match(/[\u4e00-\u9fff]{2,6}/) || [])[0];
      return brand && title.indexOf(brand) >= 0;
    }) || null;
  }
  function liftPct(it) {
    if (it._views) return Math.max(4, Math.round(100 * it._views / MAXV));
    const rank = matchedRank(it);
    if (!rank || !rank.last || !rank.last.value) return null;
    const rows = rankRows();
    const max = Math.max.apply(null, rows.map(r => r.last.value).concat([1]));
    return Math.max(4, Math.round(100 * rank.last.value / max));
  }
  function secLabel(it) {
    return displayLabel(String(it._sec || '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').trim());
  }
  function whyPill(it) {
    if (it._views) return '浏览 ' + fmt(it._views);
    const src = it.source_types || [];
    if (src.indexOf('媒体') >= 0) return '媒体报道';
    if (src.length) return src[0];
    return it.tag || '';
  }
  function stampOf(it) {
    if (it.tag === '传闻') return '<span class="pstamp q">待核实</span>';
    if (it.tag === '实锤' || (it.source_types || []).indexOf('媒体') >= 0) return '<span class="pstamp g">已见报</span>';
    return '';
  }
  function heatRow(views) {
    return PostUI.heatBadge(views, MAXV);
  }
  function freshMark(g) {
    return isFresh(g) ? '<span class="pdot"></span><span class="pnt">有新进展</span>' : '';
  }
  function paperNodes(g) {
    const nodes = [];
    ((g.root.detail || {}).timeline || []).forEach((t, i) => nodes.push({ date: t.date || '', text: t.text || '', url: t.url || '', i: i }));
    g.members.forEach((m, i) => {
      const post = PostUI.primaryOf(m, posts());
      nodes.push({ date: m.date || '', text: m.text || '', url: post.url || '', post: post, i: 100 + i });
    });
    return PostUI.sortNewest(nodes);
  }
  function nodeOrig(node, root) {
    if (node.post) return PostUI.origBlock(node.post, { clamp: true, formatTime: fmtTs });
    if (!node.url) return '';
    const known = new Set(PostUI.sourcesOf(root || {}, posts()).map(s => s.url).filter(Boolean));
    if (known.has(node.url)) return '';
    return PostUI.origBlock(PostUI.mergeSnap({ url: node.url }, posts()), { clamp: true, formatTime: fmtTs });
  }
  function platBit(url) {
    const p = PostUI.platform(url);
    if (!p) return '';
    return (PostUI.LOGOS[p] || '') + '<span>' + esc({ x: 'X', xhs: '小红书', weibo: '微博', wx: '微信' }[p] || '') + '</span>';
  }
  function showPin() {
    return !state.type || state.type === 'ride';
  }
  function pinCard() {
    if (!showPin()) return '';
    const rows = ITEMS.filter(matchesDidi);
    const top = rows.slice().sort((a, b) => (b._views || 0) - (a._views || 0))[0];
    const tl = PostUI.didiTimeline(rows.map(function (it) {
      const e = it._e || {};
      return Object.assign({}, it, { section: it._sec || it.section || '', edition_date: e.edition_date || e.timestamp || '', edition_ts: e.timestamp || '' });
    }));
    const n = (tl.shown || []).length;
    const sum = n ? esc(displayLabel(top.company)) + ' · ' + n + ' 条' : '暂无新进展';
    return '<article class="pcard pin"><button type="button" class="phit open-ev" data-id="ride:didi"><div class="prow-top"><span class="pinl">置顶</span><b class="ptitle" style="font-size:16px;margin:0">' + esc(didiName()) + '</b><span class="psm">随快讯更新</span></div><p class="psum" style="margin-top:4px;color:#7A7368">' + sum + '</p>' + (top ? heatRow(top._views) : '') + '</button></article>';
  }
  function didiNode(it, paper, first) {
    const post = PostUI.primaryOf(it, posts());
    const orig = PostUI.origBlock(post, { clamp: true, formatTime: fmtTs });
    const co = displayLabel(it.company);
    const place = PostUI.placeTag(post) || PostUI.placeTag(it);
    const where = place ? ' · ' + esc(place) : '';
    if (paper) return '<div class="pnode' + (first ? ' f' : '') + '"><div class="pnh">' + esc(it.date || '') + ' · ' + esc(co) + where + '</div><div class="pnn">' + esc(it.text || '') + '</div>' + orig + '</div>';
    return '<div class="tl"><b>' + esc(it.date || '') + '</b> ' + esc(co) + where + '<div>' + esc(it.text || '') + '</div>' + orig + '</div>';
  }
  function didiGroup(title, list, paper) {
    if (!list.length) return '';
    const body = list.map((it, i) => didiNode(it, paper, i === 0)).join('');
    if (paper) return '<h3 style="margin:16px 0 6px;font-size:16px">' + esc(title) + '</h3><div class="ptl">' + body + '</div>';
    return '<section class="ov-sec"><h3>' + esc(title) + '</h3><p class="note">最新在上</p>' + body + '</section>';
  }
  function didiOverlay() {
    const tl = PostUI.didiTimeline(didiItems());
    const paper = document.documentElement.dataset.ui !== 'classic';
    const n = (tl.foreign || []).length + (tl.rest || []).length;
    const head = paper
      ? '<div class="pkick">追踪 · 最新在上</div><h2 id="ovtitle" class="ptitle" style="font-size:22px">' + esc(didiName()) + '</h2><p class="psum">滴滴 · 随快讯更新 · ' + n + ' 条线索' + ((tl.stubs || []).length ? ' · 另有 ' + tl.stubs.length + ' 条快讯记录' : '') + '</p>'
      : '<h2 id="ovtitle">' + esc(didiName()) + '</h2><p class="note">滴滴 · 随快讯更新 · 最新在上 · ' + n + ' 条线索</p>';
    return head + didiGroup('海外小语种线索', tl.foreign || [], paper) + didiGroup('其他线索', tl.rest || [], paper) + didiGroup('快讯记录', tl.stubs || [], paper);
  }
  function eventCard(g, hero) {
    const it = g.root;
    const s = itemStory(it);
    const prog = latestProg(g);
    const n = ((it.detail || {}).timeline || []).length;
    const kick = hero ? '<div class="pkick">头瓜' + (n ? ' · 连载第' + n + '回' : '') + '</div>' : '';
    const title = '<h2 class="' + (hero ? '' : 'ptitle') + '">' + hl(s.title) + freshMark(g) + (hero ? '' : '<span class="psm">' + esc(secLabel(it)) + '</span>') + '</h2>';
    const head = hero ? title : '<div class="prow-top">' + title + '</div>';
    const progHtml = prog && prog.text ? '<div class="pprog"><i>' + esc(prog.date || '') + '</i>' + esc(prog.text) + '</div>' : '';
    return '<article class="pcard tk ' + (hero ? 'phero' : '') + '"><button type="button" class="phit open-ev" data-id="' + esc(it.id) + '">' + kick + head + '<p class="psum one">' + esc(s.sum) + '</p>' + progHtml + heatRow(groupViews(g)) + '</button>' + itemOrig(it) + '</article>';
  }
  function leadCompact(it) {
    const s = itemStory(it);
    const pct = liftPct(it);
    const bar = pct == null ? '' : '<div class="pmtr"><span class="pwhy">' + esc(whyPill(it)) + '</span><span>相对热度</span><div class="phb ap"><i style="width:' + pct + '%"></i></div><span>' + pct + '%</span></div>';
    return '<article class="pcard nw"><button type="button" class="phit open-ev" data-id="' + esc(it.id) + '"><div class="prow-top"><span class="ptitle" style="font-size:15px">' + hl(s.title) + '</span>' + stampOf(it) + '</div><p class="psum one">' + esc(s.sum) + '</p>' + heatRow(it._views) + bar + '</button>' + itemOrig(it) + '</article>';
  }
  function leadCard(it) {
    const s = itemStory(it);
    const pct = liftPct(it);
    const bar = pct == null ? '' : '<div class="pmtr"><span>相对热度</span><div class="phb ap"><i style="width:' + pct + '%"></i></div><b>' + pct + '%</b></div>';
    const why = whyPill(it);
    return '<article class="pcard nw"><div style="display:flex;align-items:center;gap:8px">' + (why ? '<span class="pwhy">' + esc(why) + '</span>' : '') + '<span style="margin-left:auto">' + stampOf(it) + '</span></div><button type="button" class="ptitle phit open-ev" data-id="' + esc(it.id) + '">' + hl(s.title) + '</button><p class="psum">' + esc(s.sum) + '</p>' + itemOrig(it) + heatRow(it._views) + bar + '<div class="pacts"><button type="button" class="p" data-promo="' + esc(it.id) + '">转入追踪</button><button type="button" data-hide="' + esc(it.id) + '">忽略</button></div></article>';
  }
  function heatOpenId(topic) {
    const id = PostUI.matchTopic(topic, heatCands());
    const it = id && ITEMS.find(x => x.id === id);
    const text = String((it && it.text) || '').trim();
    const stub = text.indexOf('本期无新动态') === 0 || text.indexOf('本期无重大新动态') === 0 || text.indexOf('本期有新动态') === 0;
    if (it && !stub) return id;
    if (/滴滴|didi|99app/i.test(String(topic || ''))) return 'ride:didi';
    return 'heat:' + topic;
  }
  function heatOverlay(topic) {
    const row = rankRows().find(r => r.t === topic) || dedupeHeat(topicGroups()).find(r => r.t === topic || (r.also || []).indexOf(topic) >= 0);
    const short = (D.shortterm || []).find(t => t.name === topic);
    const id = PostUI.matchTopic(topic, heatCands());
    const paper = document.documentElement.dataset.ui !== 'classic';
    const summary = row
      ? (heatMetricLabel(row.last.metric) + ' ' + fmt(row.last.value) + (row.delta == null ? '' : '，较前一日 ' + (row.delta > 0 ? '+' : '') + fmt(row.delta)) + '。从记录时间算到最近一期，按 36 小时半衰期衰减。' + (row.fresh ? '这条还在最近 48 小时内。' : '这条已超过 48 小时，所以排在新话题后面。') + (row.kind === 'views' ? '没有发帖计数，榜上用的是代表帖浏览。' : '这个数字是发帖量，不是卡片浏览。'))
      : ((short && short.reason) || 'topics.md 里有这个话题，heat_log 没有单独的日发帖序列。');
    let pts = row && row.pts && row.pts.length ? row.pts.slice() : [];
    if (!pts.length && row && row.last) {
      pts = (D.heat || []).filter(r => r.topic === topic && r.metric === row.last.metric).map(r => ({ t: r.timestamp_utc, v: +r.value, partial: String(r.metric).indexOf('partial') >= 0 }));
    }
    pts.sort((a, b) => String(b.t).localeCompare(String(a.t)));
    const kind = row && row.last ? heatMetricLabel(row.last.metric) : '记录';
    const nodes = pts.map(p => '<div class="' + (paper ? 'pnode' : 'tl') + '"><b>' + esc(fmtHeatDay(p.t)) + (p.partial ? ' 未完结' : '') + '</b> ' + esc(kind) + ' ' + fmt(p.v) + '</div>').join('');
    const names = [topic].concat((row && row.also) || []);
    const seenPost = {};
    let samples = [];
    names.forEach(name => {
      PostUI.heatSamples(name, D.heat, posts(), ITEMS).forEach(p => {
        const pid = xId(p.url);
        if (!pid || seenPost[pid]) return;
        seenPost[pid] = 1;
        samples.push(p);
      });
    });
    samples = PostUI.orderPosts(samples);
    const reason = PostUI.heatEmptyReason(topic, samples, D.heat);
    const about = PostUI.heatAbout(samples) || reason;
    const sampleHtml = samples.map(p => PostUI.origBlock(p, { clamp: true, formatTime: fmtTs })).join('');
    const ui = document.documentElement.dataset.ui === 'classic' ? 'classic' : 'new';
    const note = !id ? names.map(n => (D.notes || {})[n]).find(Boolean) : null;
    const noteHtml = note ? '<div class="pnote topic-note" data-topic-note="1"><h3>这是什么事</h3><p class="psum">' + esc(note.summary) + '</p><p class="note">可信度：<b>' + esc(note.credibility || '待核实') + '</b>' + (note.event_time ? ' · 事件时间 ' + esc(note.event_time) : '') + ' · 录入 ' + esc(fmtTs(note.recorded_at) || note.recorded_at || '') + '</p>' + ((note.sources || []).length ? '<ul>' + note.sources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label || s.url) + '</a></li>').join('') + '</ul>' : '') + ((note.pending || []).map(x => '<p class="note">' + esc(x) + '</p>').join('')) + '</div>' : '';
    const page = id ? '<p class="pfoot"><a href="events/' + encodeURIComponent(id) + '.html?ui=' + ui + '">独立页面</a></p>' : '<p class="note">现有期次里没有单独的事件页。上面只显示 heat_log 里写了 status 链接、并且已经缓存的帖。</p>';
    const head = paper
      ? '<div class="pkick">热榜 · 最新在上</div><h2 id="ovtitle" class="ptitle" style="font-size:22px">' + esc(displayLabel(topic)) + '</h2><p class="psum heat-about"><b>这是在说什么</b> ' + esc(about) + '</p><p class="note">' + esc(summary) + '</p>'
      : '<h2 id="ovtitle">' + esc(displayLabel(topic)) + '</h2><p class="heat-about"><b>这是在说什么</b> ' + esc(about) + '</p><p class="note">' + esc(summary) + '</p>';
    const chartPts = pts.slice().sort((a, b) => String(a.t).localeCompare(String(b.t)));
    const chart = chartPts.length ? trendChart(chartPts) : (row ? trendChart(row.pts) : '');
    const seriesName = row && row.last ? heatMetricLabel(row.last.metric) : '记录';
    const empty = '<p class="xmiss" data-heat-empty="1">' + esc(reason) + '</p><p class="note">之后的采集要在 heat_log.csv 另起一行：metric 填 x_sample_post，source 填 https://x.com/账号/status/数字。</p>';
    return head + noteHtml + '<h3>代表帖</h3>' + (sampleHtml || empty) + chart + '<h3>' + seriesName + '</h3>' + (nodes || '<p class="note">没有日发帖序列</p>') + page;
  }
  function frontEvents(events) {
    const fresh = (events || []).filter(g => eventHours(g) <= PostUI.FRONT_FRESH_H);
    if (fresh.length) return fresh;
    return (events || []).slice().sort((a, b) => (progressMs(b) || 0) - (progressMs(a) || 0) || eventScore(b) - eventScore(a)).slice(0, 6);
  }
  function paperHome(pack) {
    const shown = frontEvents(pack.events);
    const hero = shown[0] || null;
    const rest = shown.filter(g => g !== hero);
    const leads = pack.leads.slice(0, 3);
    const main = pinCard() + (hero ? eventCard(hero, true) : '') + '<div class="pevents">' + rest.map(g => eventCard(g, false)).join('') + '</div>';
    const railLeads = '<div class="psec"><b>新线索</b><button type="button" data-ptab="leads">全部 ' + pack.leads.length + ' 条 ›</button></div>' + (leads.length ? leads.map(leadCompact).join('') : '<p class="pfoot">没有待核的新线索。</p>');
    const ranks = rankRows().slice(0, 5);
    const railHeat = '<div class="prail-heat"><div class="psec"><b style="color:#4A6FA5">热榜</b><button type="button" data-ptab="heat">全部 ›</button></div>' + (ranks.length ? ranks.map((r, i) => '<article class="pcard"><button type="button" class="phit open-ev heat-hit" data-id="' + esc(heatOpenId(r.t)) + '"><div class="prow-top"><b>' + (i + 1) + ' ' + esc(displayLabel(r.t)) + '</b><span class="psm">' + fmt(r.last.value) + '</span></div><div class="note">' + esc(heatMetricLabel(r.last.metric)) + ' · ' + esc(fmtHeatDay(r.last.timestamp_utc)) + (r.fresh ? '' : ' · 已超过 48 小时') + '</div></button></article>').join('') : '') + '</div>';
    return '<div class="playout"><div class="pmain">' + (main || '<p class="pfoot">这一栏没有正在追踪的事件。</p>') + '</div><aside class="prail">' + railLeads + railHeat + '</aside></div><p class="pfoot">置顶是滴滴，随快讯更新。头瓜只留给最后进展在最近一期 48 小时内、衰减后仍最高的事件。最近一期的报道会自动进头版。48 小时内没有事件时，头版改显示最新的几条。</p>';
  }
  function paperLeads(pack) {
    return '<div class="pleads"><div class="psec"><b>新线索</b><span>相对热度＝本条浏览÷本期最高浏览，仅供参考，不会自动转入追踪</span></div>' + (pack.leads.length ? pack.leads.map(leadCard).join('') : '<p class="pfoot">新线索都处理完了。</p>') + '</div>';
  }
  function paperHeat() {
    const rows = rankRows();
    const blocks = rows.map(r => '<article class="pcard"><button type="button" class="phit open-ev heat-hit" data-id="' + esc(heatOpenId(r.t)) + '"><b>' + esc(displayLabel(r.t)) + '</b><div class="note">' + esc(heatMetricLabel(r.last.metric)) + ' · ' + esc(fmtHeatDay(r.last.timestamp_utc)) + (r.fresh ? '' : ' · 已超过 48 小时') + (r.delta == null ? '' : ' · 较前一日 ' + (r.delta > 0 ? '+' : '') + fmt(r.delta)) + '</div><div class="phr"><span class="pnum">' + fmt(r.last.value) + '</span></div></button>' + trendChart(r.pts) + '</article>').join('');
    const shorts = shortList().map(t => '<article class="pcard"><button type="button" class="phit open-ev heat-hit" data-id="' + esc(heatOpenId(t.name)) + '"><b>' + esc(displayLabel(t.name)) + '</b><div class="note">' + esc(t.reason) + '</div><div class="note">编辑备注「热度：' + esc(t.heat) + '」不是公式结果</div></button>' + trendChart(topicSeries(t.name)) + '</article>').join('');
    return heatExplain() + '<div class="psec"><b style="color:#4A6FA5">热度榜</b><span>同一事件只保留一行</span></div><div class="pheat-grid">' + (blocks || '<p class="pfoot">没有热度序列</p>') + '</div>' + (shorts ? '<div class="psec"><b style="color:#4A6FA5">短期热点</b><span>已并入热度榜的不再重复</span></div><div class="pheat-grid">' + shorts + '</div>' : '');
  }
  function groupFor(id) {
    const pack = clusters();
    return pack.events.find(g => g.root.id === id || g.members.some(m => m.id === id)) || null;
  }
  function paperDetail(it) {
    const g = groupFor(it.id) || { root: it, members: [] };
    const root = g.root;
    const s = itemStory(root);
    const n = ((root.detail || {}).timeline || []).length;
    const nodes = paperNodes(g);
    const rank = matchedRank(root);
    const delta = rank && rank.delta != null ? '<span class="pnum">较前一日 ' + (rank.delta > 0 ? '+' : '') + fmt(rank.delta) + '</span>' : '';
    const list = nodes.length ? nodes.map((node, i) => '<div class="pnode' + (i === 0 ? ' f' : '') + '"><div class="pnh">' + esc(node.date || '') + (node.url ? ' · ' + platBit(node.url) : '') + '</div><div class="pnn">' + esc(node.text) + '</div>' + nodeOrig(node, root) + '</div>').join('') : '<p class="pfoot">暂无进展时间线</p>';
    const ui = document.documentElement.dataset.ui === 'classic' ? 'classic' : 'new';
    const cached = overlayPosts(root);
    return '<div class="pkick">专题' + (n ? ' · 连载第' + n + '回' : '') + ' · 最新在上</div><h2 id="ovtitle" class="ptitle" style="font-size:22px">' + esc(s.title) + '</h2>' + aboutHtml(cached) + postsHtml(cached) + '<p class="psum">' + esc(s.sum) + '</p>' + heatRow(groupViews(g)) + delta + '<div class="ptl">' + list + '</div><p class="pfoot"><a href="events/' + encodeURIComponent(root.id) + '.html?ui=' + ui + '">独立页面</a></p>';
  }
  function renderPaper() {
    const root = $('#paper');
    if (!root || document.documentElement.dataset.ui === 'classic') return;
    const line = editionLine();
    const pd = $('#pdate');
    const pi = $('#pissue');
    if (pd) pd.textContent = line.date;
    if (pi) pi.textContent = line.issue;
    const filters = [['', '全部'], ['ride', '网约车'], ['bigtech', '大厂'], ['adr', '中概']];
    const pf = $('#pfilters');
    if (pf) pf.innerHTML = filters.map(([k, n]) => '<button type="button" data-t="' + k + '" class="' + (state.type === k ? 'on' : '') + '">' + n + '</button>').join('');
    const pq = $('#pq');
    if (pq && pq.value !== (state.q || '')) pq.value = state.q || '';
    document.querySelectorAll('#pnav button').forEach(b => {
      const on = b.dataset.ptab === ptab;
      b.classList.toggle('on', on);
    });
    const body = $('#pbody');
    if (!body) return;
    const pack = clusters();
    if (ptab === 'leads') body.innerHTML = paperLeads(pack);
    else if (ptab === 'heat') body.innerHTML = paperHeat();
    else body.innerHTML = paperHome(pack);
    wireClamps(body);
  }
  window.paperDetail = paperDetail;

  function render() {
    let L = ITEMS.filter(match);
    if (document.documentElement.dataset.theme === 'hot') L = L.slice().sort((a, b) => b._views - a._views);
    $('#cards').innerHTML = L.map(card).join('') || '<p class="empty">没有符合条件的条目。</p>';
    $('#cnt').textContent = `共 ${L.length} / ${ITEMS.length} 条`;
    renderHero();
    renderMobile();
    renderPaper();
    wireClamps(document);
    requestAnimationFrame(function () { wireClamps(document); });
    if (openId === 'ride:didi') $('#ovbody').innerHTML = didiOverlay();
    else if (openId && String(openId).indexOf('heat:') === 0) $('#ovbody').innerHTML = heatOverlay(String(openId).slice(5));
    else if (openId) {
      const it = ITEMS.find(x => x.id === openId);
      if (it) $('#ovbody').innerHTML = document.documentElement.dataset.ui === 'classic' ? detailHTML(it) : paperDetail(it);
    }
  }
  window.render = render;
  window.card = card;
  window.heatPanel = heatPanel;
  window.shortPanel = shortPanel;

  function detailHTML(it) {
    const d = it.detail || {};
    const title = displayLabel((d.title) || (it.company + '：' + it.text.slice(0, 30)));
    const tl = d.timeline || [];
    const tr = d.x_trend;
    let trend = '';
    if (tr && (tr.values || []).length) {
      const pts = (tr.labels || []).map((lb, i) => ({ t: lb, v: +tr.values[i] || 0, partial: String(lb).indexOf('*') >= 0 }));
      trend = `<section class="ov-sec"><h3>X 每日发帖量</h3><p class="note">检索式 ${esc(tr.query || '')} · 抓取 ${esc(fmtTs(tr.fetched_at || ''))} · ${esc(tr.note || '')}</p>${trendChart(pts)}${heatExplain()}</section>`;
    }
    const sorted = PostUI.sortNewest(tl.map((t, i) => Object.assign({ i: i }, t)));
    const known = new Set(PostUI.sourcesOf(it, posts()).map(s => s.url).filter(Boolean));
    const ui = document.documentElement.dataset.ui === 'classic' ? 'classic' : 'new';
    const cached = overlayPosts(it);
    return `<h2 id="ovtitle">${esc(title)}</h2>
${aboutHtml(cached)}
<div class="note spanline" title="${esc(SPAN_TIP)}">${esc(eventSpan(it))}</div>
<div class="meta" style="margin:8px 0"><span class="pill">${esc(displayLabel(it.company))}</span> <span class="badge ${it.tag === '实锤' ? 'b-real' : 'b-rum'}">【${esc(it.tag)}】</span> ${heatRow(it._views)}</div>
<section class="ov-sec"><h3>代表帖</h3>${postsHtml(cached)}</section>
<p>${esc(d.summary || it.text)}</p>
${d.background ? `<section class="ov-sec"><h3>事件经过</h3><p>${esc(d.background)}</p></section>` : ''}
<section class="ov-sec"><h3>时间线</h3><p class="note">最新在上</p>${sorted.length ? sorted.map(t => `<div class="tl"><b>${esc(fmtTs(t.date))}</b> ${esc(t.text || '')}${t.url && !known.has(t.url) ? PostUI.origBlock(PostUI.mergeSnap({ url: t.url }, posts()), { clamp: true, formatTime: fmtTs }) : ''}</div>`).join('') : '<p class="empty">暂无进展时间线</p>'}</section>
${trend || `<section class="ov-sec"><h3>热度</h3>${heatExplain()}</section>`}
${(d.responses || []).length ? `<section class="ov-sec"><h3>各方回应</h3>${d.responses.map(r => `<p><b>${esc(r.party || '')}</b> ${esc(r.text || '')}</p>`).join('')}</section>` : ''}
<p class="note"><a href="events/${encodeURIComponent(it.id)}.html?ui=${ui}">独立页面</a> · 分享用当前链接即可，关闭后筛选和滚动还在。</p>`;
  }
  function lockOpen() {
    const y = window.scrollY || 0;
    document.body.dataset.lockY = String(y);
    document.body.style.top = `-${y}px`;
    document.body.classList.add('ov-open');
  }
  function unlock() {
    const y = parseInt(document.body.dataset.lockY || '0', 10) || 0;
    document.body.classList.remove('ov-open');
    document.body.style.top = '';
    window.scrollTo(0, y);
  }
  function openEvent(id, fromPop) {
    const heatTopic = String(id || '').indexOf('heat:') === 0 ? String(id).slice(5) : '';
    const synthetic = id === 'ride:didi' || !!heatTopic;
    const it = synthetic ? null : ITEMS.find(x => x.id === id);
    if (!synthetic && !it) return;
    openId = id;
    if (!fromPop) {
      returnEl = document.activeElement;
      const u = new URL(location.href);
      u.searchParams.set('e', id);
      history.pushState({ e: id }, '', u.pathname + u.search + u.hash);
      lockOpen();
    } else if (!$('#overlay') || $('#overlay').hidden) {
      lockOpen();
    }
    $('#ovbody').innerHTML = heatTopic ? heatOverlay(heatTopic) : (id === 'ride:didi' ? didiOverlay() : (document.documentElement.dataset.ui === 'classic' ? detailHTML(it) : paperDetail(it)));
    wireClamps($('#ovbody'));
    const ov = $('#overlay');
    ov.hidden = false;
    const dlg = ov.querySelector('.modal');
    if (dlg) dlg.focus();
  }
  function hideOverlay() {
    const ov = $('#overlay');
    if (!ov || ov.hidden) { openId = null; return; }
    ov.hidden = true;
    openId = null;
    unlock();
    if (returnEl && returnEl.focus) { try { returnEl.focus(); } catch (e) {} }
    returnEl = null;
  }
  function closeEvent() {
    if ($('#overlay').hidden) return;
    if (new URL(location.href).searchParams.get('e')) history.back();
    else hideOverlay();
  }

  function mcard(it) {
    const badge = it._views ? fmt(it._views) + (it._views >= 1e5 ? ' 爆' : it._views >= 1e4 ? ' 热' : '') : '无浏览';
    const s = itemStory(it);
    const prog = s.parent ? '<span class="prog">事件进展</span>' : '';
    return `<article class="mcard" style="--c:${it._col}"><button type="button" class="mhit open-ev" data-id="${esc(it.id)}"><div class="mtop"><b>${esc(displayLabel(it.company))}</b><span class="hbadge" title="链接最高浏览量，不是热度榜日发帖量">${esc(badge)}</span></div><div class="mspan spanline">${esc(eventSpan(it))}</div>${prog}<h3 class="evtitle">${hl(s.title)}</h3></button><div class="kicker">${s.kicker}</div>${foldable('sum', hl(s.sum))}<div class="kicker">原文</div>${itemOrig(it)}<div class="links">${linksHtml(it)}</div></article>`;
  }
  function mobileHeat() {
    const rows = rankRows();
    const slides = rows.map((r, i) => `<section class="mslide"><button type="button" class="open-ev heat-hit" data-id="${esc(heatOpenId(r.t))}"><div class="note">第 ${i + 1} 名</div><h3>${esc(displayLabel(r.t))}</h3><div class="bigv">${fmt(r.last.value)}</div><div class="note">${r.delta == null ? '' : (r.delta > 0 ? '+' : '') + fmt(r.delta) + ' 较前一日'}</div></button>${trendChart(r.pts)}</section>`).join('');
    const shorts = shortList().map(t => `<section class="mslide"><button type="button" class="open-ev heat-hit" data-id="${esc(heatOpenId(t.name))}"><h3>${esc(displayLabel(t.name))}</h3><div class="note">${esc(t.reason)}</div></button>${trendChart(topicSeries(t.name))}</section>`).join('');
    return heatExplain() + `<h2 class="sec">热度榜 · 左右滑</h2><div class="mswipe">${slides || '<p class="empty">没有热度序列</p>'}</div>` + (shorts ? `<h2 class="sec">短期热点</h2><div class="mswipe">${shorts}</div>` : '');
  }
  function mobileTrack() {
    const L = ITEMS.filter(isRide);
    const cards = L.slice(0, 8).map(mcard).join('') || '<p class="empty">暂无滴滴相关条目，随快讯更新</p>';
    const focus = $('#focus') ? $('#focus').innerHTML : '';
    const tl = $('#tl') ? $('#tl').innerHTML : '';
    return `<h2 class="sec">网约车</h2>${cards}<h2 class="sec">重点追踪</h2><div class="mcard">${focus}</div><h2 class="sec">期次</h2><div class="mcard">${tl}</div>`;
  }
  function renderMobile() {
    const body = $('#mbody');
    if (!body) return;
    paintTz();
    const mb = $('#mbuilt');
    if (mb) mb.textContent = '看板生成 ' + fmtTs(D.built) + ' · 默认北京时间';
    const filters = [['', '全部'], ['ride', '网约车'], ['bigtech', '大厂'], ['adr', '中概']];
    const mf = $('#mfilters');
    if (mf) mf.innerHTML = filters.map(([k, n]) => `<button type="button" data-t="${k}" class="${state.type === k ? 'on' : ''}">${n}</button>`).join('');
    document.querySelectorAll('#mnav button').forEach(b => b.classList.toggle('on', b.dataset.tab === mtab));
    if (mtab === 'heat') body.innerHTML = mobileHeat();
    else if (mtab === 'track') body.innerHTML = mobileTrack();
    else {
      const L = ITEMS.filter(match);
      body.innerHTML = L.map(mcard).join('') || '<p class="empty">没有符合条件的条目。</p>';
    }
    wireClamps(body);
  }

  function setUi(mode) {
    if (mode !== 'classic' && mode !== 'new') return;
    document.documentElement.dataset.ui = mode;
    try { localStorage.setItem('gossipUi', mode); } catch (err) {}
    const u = new URL(location.href);
    u.searchParams.set('ui', mode);
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    render();
  }
  document.addEventListener('click', function (e) {
    const uiBtn = e.target.closest('[data-ui-set]');
    if (uiBtn) { setUi(uiBtn.getAttribute('data-ui-set')); return; }
    const promo = e.target.closest('[data-promo]');
    if (promo) {
      const id = promo.getAttribute('data-promo');
      const set = loadIds(PROMO_KEY); set.add(id); saveIds(PROMO_KEY, set);
      const hide = loadIds(HIDE_KEY); hide.delete(id); saveIds(HIDE_KEY, hide);
      ptab = 'home';
      render();
      return;
    }
    const hideBtn = e.target.closest('[data-hide]');
    if (hideBtn) {
      const id = hideBtn.getAttribute('data-hide');
      const set = loadIds(HIDE_KEY); set.add(id); saveIds(HIDE_KEY, set);
      const promoSet = loadIds(PROMO_KEY); promoSet.delete(id); saveIds(PROMO_KEY, promoSet);
      render();
      return;
    }
    const ptabBtn = e.target.closest('[data-ptab]');
    if (ptabBtn && !e.target.closest('.open-ev')) {
      ptab = ptabBtn.getAttribute('data-ptab') || 'home';
      const body = $('#pbody');
      if (body) body.scrollTop = 0;
      window.scrollTo(0, 0);
      renderPaper();
      return;
    }
    const pf = e.target.closest('#pfilters button[data-t]');
    if (pf) {
      state.type = pf.dataset.t;
      document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('on', x.dataset.t === state.type));
      render();
      return;
    }
    const tz = e.target.closest('.tz button[data-tz]');
    if (tz) {
      if (tz.dataset.tz === tzMode) return;
      tzMode = tz.dataset.tz;
      try { localStorage.setItem(TZKEY, tzMode); } catch (err) {}
      paintHeader();
      heatPanel();
      timeline();
      ridePanel();
      render();
      return;
    }
    const tab = e.target.closest('#mnav button[data-tab]');
    if (tab) { mtab = tab.dataset.tab; renderMobile(); return; }
    const mf = e.target.closest('#mfilters button[data-t]');
    if (mf) {
      state.type = mf.dataset.t;
      mtab = 'feed';
      document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('on', x.dataset.t === state.type));
      render();
      return;
    }
    const opener = e.target.closest('.open-ev');
    if (opener) { e.preventDefault(); openEvent(opener.dataset.id, false); return; }
    if (e.target && e.target.dataset && e.target.dataset.close) { closeEvent(); return; }
    const pt = e.target.closest('.pt');
    if (pt) showTip(pt);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeEvent();
    const pt = e.target.closest && e.target.closest('.pt');
    if (pt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showTip(pt); }
  });
  window.addEventListener('popstate', function () {
    const id = new URL(location.href).searchParams.get('e');
    if (id) openEvent(id, true);
    else hideOverlay();
  });
  const pq = $('#pq');
  if (pq) pq.addEventListener('input', function () {
    state.q = pq.value.trim().toLowerCase();
    const q = $('#q');
    if (q && q.value !== pq.value) q.value = pq.value;
    const mq = $('#mq');
    if (mq && mq.value !== pq.value) mq.value = pq.value;
    render();
  });
  const mq = $('#mq');
  if (mq) mq.addEventListener('input', function () {
    state.q = mq.value.trim().toLowerCase();
    const q = $('#q');
    if (q && q.value !== mq.value) q.value = mq.value;
    mtab = 'feed';
    render();
  });

  function paintTrackerChrome() {
    const slot = $('#didi-name');
    if (slot) slot.textContent = didiName();
    const sel = $('#fco');
    if (sel && !sel.dataset.labeled) {
      const cur = state.co || '';
      const cos = [...new Set(ITEMS.flatMap(i => String(i.company || '').split(/\s*\/\s*/)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
      sel.innerHTML = '<option value="">全部公司</option>' + cos.map(c => '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(displayLabel(c)) + '</option>').join('');
      sel.dataset.labeled = '1';
    }
  }
  paintTrackerChrome();
  heatPanel();
  focusPanel();
  shortPanel();
  timeline();
  ridePanel();
  render();
  window.addEventListener('resize', function () { wireClamps(document); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { wireClamps(document); });
  const deep = new URL(location.href).searchParams.get('e');
  if (deep) openEvent(deep, true);
})();
