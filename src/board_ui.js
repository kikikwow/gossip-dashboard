/* UX layer: heat explanation, time spans, event overlay, X cache, mobile shell.
   Depends on globals from dashboard_template.html (D, ITEMS, $, esc, fmt, fmtTs, parseTs, fmtHeatDay, state, paintHeader, paintTz, TZKEY, tzMode, isRide, focusPanel, timeline, ridePanel, hl, match, MAXV, TYPES). */
(function () {
  let openId = null;
  let returnEl = null;
  let mtab = 'feed';

  function fmtMaybe(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return fmt(v);
    const n = Number(String(v).replace(/,/g, ''));
    if (Number.isFinite(n) && String(v).match(/^\d+(\.\d+)?$/)) return fmt(n);
    return String(v);
  }
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
  function xBlock(url, extra, clamp) {
    if (!xId(url)) return '';
    const snap = xSnap(url) || {};
    const ex = extra || {};
    const text = ex.text || snap.text || '';
    const author = ex.author || snap.author || '';
    const name = ex.author_name || snap.name || '';
    const created = ex.created_at || snap.created_at;
    const views = ex.views != null ? ex.views : snap.views;
    const likes = ex.likes != null ? ex.likes : snap.likes;
    const reposts = ex.reposts != null ? ex.reposts : snap.reposts;
    const bits = [name, author].filter(Boolean).join(' ');
    const meta = `<div class="xmeta"><b>${esc(bits || 'X')}</b>${created ? `<span class="note">${esc(fmtTs(created))}</span>` : ''}${views != null && views !== '' ? `<span class="note">浏览 ${esc(fmtMaybe(views))}</span>` : ''}${likes != null && likes !== '' ? `<span class="note">赞 ${esc(fmtMaybe(likes))}</span>` : ''}${reposts != null && reposts !== '' ? `<span class="note">转 ${esc(fmtMaybe(reposts))}</span>` : ''}</div>`;
    const body = text ? (clamp ? foldable('xtext', esc(text)) : `<p class="xtext">${esc(text)}</p>`) : `<p class="xmiss">正文未缓存</p>`;
    return `<blockquote class="xbody">${meta}${body}${extLink(url, '原链接（站外）')}</blockquote>`;
  }
  function foldLimit(cls) {
    return cls === 'xtext' ? 72 : 40;
  }
  const LOGOS = {
    x: '<svg class="plogo" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    xhs: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="#ff2442"/><text x="8" y="12" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="PingFang SC,Noto Sans SC,sans-serif">小</text></svg>',
    weibo: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#e6162d"/><ellipse cx="8" cy="8.4" rx="5" ry="3" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="10.1" cy="8.3" r="1.45" fill="#fff"/></svg>',
    wx: '<svg class="plogo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="#07c160"/><circle cx="6.1" cy="7" r="3.1" fill="#fff"/><circle cx="10.3" cy="9.3" r="2.5" fill="#fff"/><circle cx="5.2" cy="6.7" r=".55" fill="#07c160"/><circle cx="7" cy="6.7" r=".55" fill="#07c160"/><circle cx="9.6" cy="9" r=".45" fill="#07c160"/><circle cx="11" cy="9" r=".45" fill="#07c160"/></svg>'
  };
  const PNAME = { x: 'X', xhs: '小红书', weibo: '微博', wx: '微信' };
  function platform(url) {
    let host = '';
    try { host = new URL(String(url), 'https://local.invalid').hostname.toLowerCase().replace(/^www\./, ''); }
    catch (e) { return ''; }
    if (!host || host === 'local.invalid') return '';
    if (host === 'x.com' || host === 'twitter.com' || host === 't.co' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) return 'x';
    if (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || host === 'xhslink.com' || host.endsWith('.xhslink.com')) return 'xhs';
    if (host === 'weibo.com' || host.endsWith('.weibo.com') || host === 'weibo.cn' || host.endsWith('.weibo.cn')) return 'weibo';
    if (host === 'weixin.qq.com' || host.endsWith('.weixin.qq.com') || host === 'wechat.com' || host.endsWith('.wechat.com')) return 'wx';
    return '';
  }
  function extLink(url, labelHtml) {
    const p = platform(url);
    const cls = p ? 'ext ext-' + p : 'ext';
    const tip = p ? ` title="${esc(PNAME[p])}"` : '';
    return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener"${tip}>${p ? LOGOS[p] : ''}<span>${labelHtml}</span></a>`;
  }
  function plainLen(html) {
    return String(html || '').replace(/<[^>]+>/g, '').replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, 'x').replace(/\s+/g, '').length;
  }
  function foldable(cls, html) {
    const n = plainLen(html);
    const limit = foldLimit(cls);
    const long = n > limit;
    return `<div class="clampbox" data-len="${n}" data-fold="${limit}"><p class="${cls} clamp">${html}</p><button type="button" class="xmore"${long ? '' : ' hidden'} aria-expanded="false">展开</button></div>`;
  }
  function wireClamps(root) {
    (root || document).querySelectorAll('.clampbox').forEach(box => {
      const el = box.querySelector('.clamp');
      const btn = box.querySelector('.xmore');
      if (!el || !btn) return;
      const force = (+box.getAttribute('data-len') || 0) > (+box.getAttribute('data-fold') || 80);
      if (box.offsetParent === null) {
        if (force) btn.hidden = false;
        return;
      }
      if (box.classList.contains('is-open')) {
        btn.hidden = false;
        btn.textContent = '收起';
        btn.setAttribute('aria-expanded', 'true');
        return;
      }
      const overflow = el.scrollHeight > el.clientHeight + 2;
      btn.hidden = !(force || overflow);
      btn.textContent = '展开';
      btn.setAttribute('aria-expanded', 'false');
    });
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
<p>热度榜不是加权综合分。榜上的数字是 heat_log.csv 里该话题指标 x_daily_post_count 的<strong>最近一个完整 UTC 日发帖量</strong>（按当时的 X 检索式统计当天帖子数），从高到低取前 10。这个话题如果没有日发帖量，才退回时间上最后一条其他指标。</p>
<p>折线按时间排同一指标。图上有纵轴刻度、每个点的精确值，以及最后两个完整日的差额。名字里带 partial 的是采集截止前的未完成日，只补在图末尾，<strong>不参与排名</strong>。</p>
<p>卡片上的「浏览」是另一套数：该条 links 浏览量的最大值（万/亿/k/M）。热榜皮肤按它排序；≥10 万标「爆」，≥1 万标「热」。条宽用相对最大值的平方根，避免头部把其余挤没。</p>
<p>topics.md 里的「热度：待更新」是编辑备注，不是算出来的。这份快照有 ${H.length} 条热度记录（日发帖 ${dailyN} 条），最新时间 ${esc(asof)}。榜单不会每小时自己滚，要更新得重新采集、追加 csv，再跑构建。</p>
</div></div>`;
  }
  function topicSeries(topic) {
    const H = D.heat || [];
    const daily = H.filter(r => r.topic === topic && r.metric === 'x_daily_post_count').slice().sort((a, b) => a.timestamp_utc < b.timestamp_utc ? -1 : 1);
    const partial = H.filter(r => r.topic === topic && String(r.metric).indexOf('partial') >= 0).slice().sort((a, b) => a.timestamp_utc < b.timestamp_utc ? -1 : 1);
    const pts = daily.map(r => ({ t: r.timestamp_utc, v: +r.value, partial: false }));
    partial.forEach(r => pts.push({ t: r.timestamp_utc, v: +r.value, partial: true }));
    return pts;
  }
  function rankRows() {
    const H = D.heat || [];
    if (!H.length) return [];
    const by = {};
    H.forEach(r => { (by[r.topic] = by[r.topic] || []).push(r); });
    return Object.keys(by).map(t => {
      const rs = by[t].slice().sort((a, b) => a.timestamp_utc < b.timestamp_utc ? -1 : 1);
      const daily = rs.filter(r => r.metric === 'x_daily_post_count');
      const last = daily.length ? daily[daily.length - 1] : rs[rs.length - 1];
      const prev = daily.length >= 2 ? daily[daily.length - 2] : null;
      return { t: t, last: last, delta: prev ? last.value - prev.value : null, pts: topicSeries(t) };
    }).sort((a, b) => b.last.value - a.last.value).slice(0, 10);
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
    const title = d.title || (parent ? parent.detail.title : headline(it));
    const sum = d.summary || it.text || '';
    return { title: title, parent: parent, sum: sum, kicker: d.summary ? '摘要' : '条目摘要', fx: firstX(it) };
  }
  function storyBlock(it, withTitle) {
    const s = itemStory(it);
    const head = withTitle ? `${s.parent ? '<span class="prog">事件进展</span>' : ''}<h3 class="evtitle">${hl(s.title)}</h3>` : '';
    const orig = s.fx ? `<div class="kicker">原文</div>${xBlock(s.fx.url, s.fx, true)}` : '';
    return `${head}<div class="kicker">${s.kicker}</div>${foldable('sum', hl(s.sum))}${orig}`;
  }
  function linksHtml(it) {
    return (it.links || []).map(l => {
      const known = platform(l.url);
      return `<div class="linkrow">${known ? '' : '🔗 '}${extLink(l.url, hl(l.label))}${l.views ? `<span class="vw">👁 ${esc(l.views)}</span>` : ''}</div>`;
    }).join('');
  }
  function card(it) {
    const e = it._e;
    const badge = it._views >= 1e5 ? '爆' : it._views >= 1e4 ? '热' : '';
    return `<article class="card" data-id="${esc(it.id)}" style="--c:${it._col}"><div class="heatbar">${it._views ? `<b>${fmt(it._views)}</b> 浏览${badge ? `<span class="hotb">${badge}</span>` : ''}<div class="hbar"><i style="width:${(Math.sqrt(it._views / MAXV) * 100).toFixed(1)}%"></i></div>` : '<span>暂无浏览数据</span>'}</div><div class="top"><span class="pill">${hl(it.company)}</span>${it.detail ? '<span class="rich">深度</span>' : ''}
<span class="badge ${it.tag === '实锤' ? 'b-real' : 'b-rum'}">【${esc(it.tag)}】</span>${(it.source_types || []).map(s => `<span class="src">${esc(s)}</span>`).join('')}<span class="date spanline" title="${esc(SPAN_TIP)}">${esc(eventSpan(it))}</span></div>
<div class="secn">${esc(TYPES[e.type] || e.type)} · ${esc(it._sec)} ${it._views ? `<span class="hbadge" title="浏览=该条链接里最高浏览量，不是热度榜的日发帖量。≥10万爆，≥1万热。">${fmt(it._views)} 浏览${badge ? ' ' + badge : ''}</span> <span class="note">按该条链接最高浏览量</span>` : '<span class="note">这条没有浏览量</span>'}</div>${storyBlock(it, true)}
<button type="button" class="more open-ev" data-id="${esc(it.id)}">查看事件详情</button><div class="links">${linksHtml(it)}</div></article>`;
  }
  function renderHero() {
    if (state.type === 'ride') {
      const L = ITEMS.filter(isRide).slice(0, 3);
      $('#herolbl').textContent = L.length ? `网约车匹配 ${ITEMS.filter(isRide).length} 条` : '';
      const grads = ['linear-gradient(135deg,#ff6b4a,#c2185b)', 'linear-gradient(135deg,#7c3aed,#4f46e5)', 'linear-gradient(135deg,#0ea5e9,#0d9488)'];
      $('#hero').innerHTML = L.length ? L.map((it, i) => `<div class="herocard" style="background:${grads[i]}"><div class="big">${i + 1}</div><div class="co">${esc(it.company)}</div><div class="ed spanline">${esc(eventSpan(it))}</div><p>${esc(it.text)}</p><button type="button" class="more open-ev" data-id="${esc(it.id)}" style="color:#fff">事件详情</button></div>`).join('') : '<p class="empty">暂无滴滴相关条目，每小时追踪中</p>';
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
      return `<div class="herocard" style="background:${grads[i]}"><div class="big">${i + 1}</div><div class="co">${esc(it.company)}</div><div class="ed spanline">${esc(eventSpan(it))}</div><p>${esc(it.text)}</p><button type="button" class="more open-ev" data-id="${esc(it.id)}" style="color:#fff">事件详情</button></div>`;
    }).join('');
  }
  function heatPanel() {
    const rows = rankRows();
    if (rows.length) {
      const ol = rows.map((r, i) => {
        const d = r.delta;
        const ds = d == null ? '' : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${fmt(d)} 较前一日</span>`;
        return `<li class="rankrow"><span class="no">${i + 1}</span><div class="t"><b>${esc(r.t)}</b><div class="note">${r.last.metric === 'x_daily_post_count' ? 'X 日发帖量 · ' + esc(fmtHeatDay(r.last.timestamp_utc)) : esc(r.last.metric)} ${ds}</div>${trendChart(r.pts)}</div><span class="v">${fmt(r.last.value)}</span></li>`;
      }).join('');
      $('#heat').innerHTML = heatExplain() + `<ol class="rank">${ol}</ol>`;
      return;
    }
    const L = ITEMS.filter(i => i._views > 0).sort((a, b) => b._views - a._views).slice(0, 10);
    $('#heat').innerHTML = heatExplain() + `<p class="note">heat_log.csv 暂无数据，下面临时按条目链接最高浏览量排，没有日序列。</p><ol class="rank">${L.map((it, i) => `<li><span class="no">${i + 1}</span><span class="t"><b>${esc(it.company)}</b> · ${esc(it.text.slice(0, 22))}…</span><span class="v">👁 ${fmt(it._views)}</span></li>`).join('')}</ol>`;
  }
  function shortPanel() {
    const blocks = (D.shortterm || []).map(t => `<div class="hot"><b>${esc(t.name)}</b><div class="r">${esc(t.reason)}</div><div class="note">编辑备注「热度：${esc(t.heat)}」不是公式结果 · ${esc(t.status)} · 加入 ${esc(fmtTs(t.added))}</div>${trendChart(topicSeries(t.name))}</div>`).join('');
    $('#short').innerHTML = heatExplain() + (blocks || '<p class="empty">topics.md 中暂无短期热点</p>');
  }
  function render() {
    let L = ITEMS.filter(match);
    if (document.documentElement.dataset.theme === 'hot') L = L.slice().sort((a, b) => b._views - a._views);
    $('#cards').innerHTML = L.map(card).join('') || '<p class="empty">没有符合条件的条目。</p>';
    $('#cnt').textContent = `共 ${L.length} / ${ITEMS.length} 条`;
    renderHero();
    renderMobile();
    wireClamps(document);
    requestAnimationFrame(function () { wireClamps(document); });
    if (openId) {
      const it = ITEMS.find(x => x.id === openId);
      if (it) $('#ovbody').innerHTML = detailHTML(it);
    }
  }
  window.render = render;
  window.card = card;
  window.heatPanel = heatPanel;
  window.shortPanel = shortPanel;

  function detailHTML(it) {
    const d = it.detail || {};
    const title = (d.title) || (it.company + '：' + it.text.slice(0, 30));
    const xs = allX(it);
    const tl = d.timeline || [];
    const tr = d.x_trend;
    let trend = '';
    if (tr && (tr.values || []).length) {
      const pts = (tr.labels || []).map((lb, i) => ({ t: lb, v: +tr.values[i] || 0, partial: String(lb).indexOf('*') >= 0 }));
      trend = `<section class="ov-sec"><h3>X 每日发帖量</h3><p class="note">检索式 ${esc(tr.query || '')} · 抓取 ${esc(fmtTs(tr.fetched_at || ''))} · ${esc(tr.note || '')}</p>${trendChart(pts)}${heatExplain()}</section>`;
    }
    const posts = xs.length ? xs.map(x => xBlock(x.url, x)).join('') : '<p class="xmiss">正文未缓存</p>';
    const hasX = xs.length || (d.x_posts || []).length;
    return `<h2 id="ovtitle">${esc(title)}</h2>
<div class="note spanline" title="${esc(SPAN_TIP)}">${esc(eventSpan(it))}</div>
<div class="meta" style="margin:8px 0"><span class="pill">${esc(it.company)}</span> <span class="badge ${it.tag === '实锤' ? 'b-real' : 'b-rum'}">【${esc(it.tag)}】</span> ${it._views ? `<span class="hbadge" title="链接最高浏览量">${fmt(it._views)} 浏览</span> <span class="note">按该条链接最高浏览量</span>` : ''}</div>
<p>${esc(d.summary || it.text)}</p>
${d.background ? `<section class="ov-sec"><h3>事件经过</h3><p>${esc(d.background)}</p></section>` : ''}
<section class="ov-sec"><h3>时间线</h3>${tl.length ? tl.map(t => `<div class="tl"><b>${esc(fmtTs(t.date))}</b> ${esc(t.text || '')}</div>`).join('') : '<p class="empty">暂无时间线</p>'}</section>
<section class="ov-sec"><h3>X 原文缓存</h3>${hasX ? posts : '<p class="empty">这条没有引用 X 帖。</p>'}</section>
${trend || `<section class="ov-sec"><h3>热度</h3>${heatExplain()}</section>`}
${(d.responses || []).length ? `<section class="ov-sec"><h3>各方回应</h3>${d.responses.map(r => `<p><b>${esc(r.party || '')}</b> ${esc(r.text || '')}</p>`).join('')}</section>` : ''}
<p class="note"><a href="events/${encodeURIComponent(it.id)}.html">独立页面</a> · 分享用当前链接即可，关闭后筛选和滚动还在。</p>`;
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
    const it = ITEMS.find(x => x.id === id);
    if (!it) return;
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
    $('#ovbody').innerHTML = detailHTML(it);
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
    const orig = s.fx ? `<div class="kicker">原文</div>${xBlock(s.fx.url, s.fx, true)}` : '';
    return `<article class="mcard" style="--c:${it._col}"><button type="button" class="mhit open-ev" data-id="${esc(it.id)}"><div class="mtop"><b>${esc(it.company)}</b><span class="hbadge" title="链接最高浏览量，不是热度榜日发帖量">${esc(badge)}</span></div><div class="mspan spanline">${esc(eventSpan(it))}</div>${prog}<h3 class="evtitle">${hl(s.title)}</h3></button><div class="kicker">${s.kicker}</div>${foldable('sum', hl(s.sum))}${orig}<div class="links">${linksHtml(it)}</div></article>`;
  }
  function mobileHeat() {
    const rows = rankRows();
    const slides = rows.map((r, i) => `<section class="mslide"><div class="note">第 ${i + 1} 名 · 点圆点看精确值</div><h3>${esc(r.t)}</h3><div class="bigv">${fmt(r.last.value)}</div><div class="note">${r.delta == null ? '' : (r.delta > 0 ? '+' : '') + fmt(r.delta) + ' 较前一日'}</div>${trendChart(r.pts)}</section>`).join('');
    const shorts = (D.shortterm || []).map(t => `<section class="mslide"><h3>${esc(t.name)}</h3><div class="note">${esc(t.reason)}</div>${trendChart(topicSeries(t.name))}</section>`).join('');
    return heatExplain() + `<h2 class="sec">热度榜 · 左右滑</h2><div class="mswipe">${slides || '<p class="empty">没有热度序列</p>'}</div><h2 class="sec">短期热点</h2><div class="mswipe">${shorts}</div>`;
  }
  function mobileTrack() {
    const L = ITEMS.filter(isRide);
    const cards = L.slice(0, 8).map(mcard).join('') || '<p class="empty">暂无滴滴相关条目，每小时追踪中</p>';
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

  document.addEventListener('click', function (e) {
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
    const heatBtn = e.target.closest('.heat-toggle');
    if (heatBtn) {
      e.preventDefault();
      e.stopPropagation();
      const how = heatBtn.closest('.heat-how');
      if (how) {
        const open = how.classList.toggle('is-open');
        heatBtn.textContent = open ? '收起' : '展开';
        heatBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    const box = e.target.closest('.clampbox');
    if (box && !e.target.closest('a')) {
      const btn = box.querySelector('.xmore');
      if (btn && !btn.hidden) {
        e.preventDefault();
        e.stopPropagation();
        const open = box.classList.toggle('is-open');
        btn.textContent = open ? '收起' : '展开';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }
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
  const mq = $('#mq');
  if (mq) mq.addEventListener('input', function () {
    state.q = mq.value.trim().toLowerCase();
    const q = $('#q');
    if (q && q.value !== mq.value) q.value = mq.value;
    mtab = 'feed';
    render();
  });

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
