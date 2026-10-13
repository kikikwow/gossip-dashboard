# gossip-tracking 数据与看板

## 刷新看板
    python3 /workspace/gossip-tracking/build_dashboard.py
    # 可选截图
    cd dashboard && google-chrome --headless=new --no-sandbox --hide-scrollbars --window-size=1280,900 --screenshot=preview_top.png file://$PWD/index.html
输入：data/*.json、topics.md、heat_log.csv（可缺失）；输出：dashboard/index.html（自包含，无外部依赖）。
模板：dashboard_template.html（样式/JS 在此修改）。seed_from_digests.py 仅用于一次性导入 /workspace/digests 样刊。

## data/ 每期一个 JSON：`YYYY-MM-DD[THHMM]_<type>.json`
```json
{
 "type": "bigtech | adr | alert | daily",
 "title": "中国大厂八卦简报",
 "timestamp": "2026-10-13T09:00:00Z",   // ISO 8601，用于排序（同一时间时 daily>bigtech>adr）
 "edition_date": "2026-10-13",
 "lede": "覆盖范围/信源说明（可选）",
 "top3": [{"section": "<sections[].title>", "index": 0}],   // 指向 sections 内条目
 "sections": [{
   "title": "🚗 公关翻车 & 车圈互撕", "color": "#e4572e",
   "items": [{
     "company": "华为·尊界 / 江淮",        // 多公司用 " / " 分隔，用于公司筛选
     "tag": "实锤 | 传闻",
     "source_types": ["X", "媒体", "微博", "小红书", "雪球"],
     "date": "10-08",                      // 事件日期（自由文本）
     "text": "正文",
     "links": [{"label": "X @user", "url": "https://...", "views": "14.7万"}]  // views 可为 null；支持 万/亿/k/M/逗号
   }]
 }]
}
```
快讯(alert)可只放一个 section；每日总结(daily)同理。新增期次只需追加文件后重跑脚本。

## heat_log.csv
列：`timestamp_utc,topic,metric,value,source`。value 须为数字。topic 与 topics.md 短期话题名完全一致时，短期热点面板会显示走势折线；热度榜按每个 topic 最新值排序并画同 metric 的 sparkline（≥2 个点）。

## 重点追踪匹配
长期话题从 topics.md 括号内关键词 + 脚本内置别名（build_dashboard.py 中 `alias`）匹配条目的 company+text，属关键词匹配，可能有误匹配/漏匹配。

## 热度
热度榜数字 = `heat_log.csv` 里该话题 `x_daily_post_count`（X 检索式的完整 UTC 日发帖量）最近一条，从高到低前 10。没有日发帖量才退回该话题最后一条其他指标。`partial` 是采集截止前的未完成日，只出现在图上，不参与排名。卡片「浏览」是该条 `links[].views` 的最大值，不是榜上的日发帖量；≥10 万显示「爆」，≥1 万显示「热」。topics.md 的「热度」列是编辑备注。

## X 正文缓存
`python3 src/cache_x_posts.py` 读取 data 里已有的 status 链接，向 `api.fxtwitter.com` 抓公开快照，写入 `src/x_cache.json`，并给 `detail.x_posts` 补上可选字段 `text` / `author_name`（不改已有浏览数）。抓不到的项 `status=missing`，页面显示「正文未缓存」，不编正文。然后 `python3 src/build_dashboard.py` 会把缓存打进首页，并写出仓库根目录的 `index.html` 和 `events/`（Pages 用）以及 `src/dashboard/`。

## 时区
看板顶栏和事件详情页可在「北京时间」（Asia/Shanghai，UTC+8）和「UTC」之间切换。首次打开默认北京时间，选择写入 localStorage `gossipTz`，刷新后保持。只改显示格式；数据文件里的时间仍是原来的 UTC / ISO。有钟点的时间会立刻重绘，不用整页刷新。只有日期、没有钟点的事件日期（如 `10-08`）保持原文。

## 主题（v2）
看板右上角下拉切换：🌙 暗色看板 `dark` / 📰 报刊杂志 `paper` / 📱 简约信息流 `feed` / 🔥 热榜数据 `hot`。保存在 localStorage `gossipTheme`；也可用 URL `index.html#theme=paper` 强制（截图用）。详情页同样读取该设置。
截图：`for t in dark paper feed hot; do google-chrome --headless=new --no-sandbox --hide-scrollbars --window-size=1280,900 --screenshot=dashboard/theme_$t.png "file://$PWD/dashboard/index.html#theme=$t"; done`

## 事件详情
首页卡片默认在当前页打开浮层（地址栏 `?e=<id>`），关闭后筛选和滚动位置还在。每个条目仍会生成 `events/<id>.html` 独立页，浮层里有链接。条目可写 `"id"`（仅 [A-Za-z0-9_.-]），否则自动为 `<文件名>-<栏目序号>-<条目序号>`——**追加新条目时建议显式写 id，避免顺序变化导致链接变化**。渲染代码：`detail_render.py`。

卡片上的时间跨度：起 = 时间线、帖子或缓存里最早的钟点（没有钟点就用条目日期原文）；采 = 帖子指标 `fetched_at`、`enriched_at`、趋势 `fetched_at` 里最晚的。`x_cache.json` 的抓取时间不拿来覆盖采，除非这条没有任何更早的采集点。

条目可选 `detail` 对象（任意字段缺失时页面显示“暂无数据”）：
```json
"detail": {
  "title": "事件标题", "summary": "一句话摘要", "background": "事件经过（长文）",
  "enriched_at": "2026-10-13T13:15Z",
  "timeline": [{"date": "2026-10-08", "text": "进展", "url": "来源"}],
  "x_posts": [{"platform":"X","url":"...","author":"@h","created_at":"...","views":147020,"likes":326,"reposts":13,"replies":22,"quotes":1,"bookmarks":38,"fetched_at":"2026-10-13T13:08:22Z"}],
  "x_trend": {"query":"检索式","granularity":"day","labels":["10-07","10-08"],"values":[0,5566],"fetched_at":"...","source":"X get_posts_counts_recent","note":"..."},
  "weibo": {"rank": 3, "text": "说明", "url": "来源"},          // 无数据填 null
  "other_platforms": [{"platform":"股市","metric":"跌幅","value":"-10.01%","url":"..."}],
  "comments": [{"text":"原文引用","author":"@h","platform":"X","url":"原帖链接","stance":"支持|质疑|调侃"}],
  "stance_note": "评论采样与立场口径说明",
  "responses": [{"party":"回应方","text":"原话/摘要","url":"来源"}],
  "related": ["同数据集中其他条目的 company 名"],
  "extra_sources": [{"label":"...","url":"..."}]
}
```
规则：评论必须是真实原文+链接；指标必须来自工具结果并写 fetched_at；没有就留空，不要编。

## heat_log.csv 约定（v2）
- `x_daily_post_count`：timestamp 用当日 `YYYY-MM-DDT23:59:59Z`，value 为该 UTC 日发帖量 → 热度榜按最近一日排序、画折线。
- `x_post_<views|likes|reposts|replies>:@handle`：单帖指标，source 为帖子链接。
- `x_post_count_partial_<date>`：当日未完结的部分计数。
topic 用 topics.md 短期话题原名时，短期热点面板会显示折线。

## research/
`research/` 保存 2026-10-13 深度调研的原始 X 工具结果与 `enrich_details.py`（把 detail 写入 data/ 并追加 heat_log；**勿重复运行**，否则 heat_log 会重复追加）。

## 🚕 网约车特色栏目
看板顶部固定「🚕 网约车」面板，顶栏另有「网约车」标签（与全部/大厂八卦/…并列）。匹配关键词：滴滴、DiDi、99、网约车、程维、柳青、花小猪、曹操出行、T3、高德打车及出海相关词。由每小时滴滴专项例程写入 `data/` 后重跑 `build_dashboard.py` 刷新；**无匹配条目时显示空态，禁止编造**。详见 `topics.md`「特色栏目」。

## 移动端 / 微信
视口 ≤820px 时整页换成另一套结构（`#mapp`），不是把桌面三栏压扁：底栏「动态 / 热榜 / 追踪」、竖向信息流、热榜左右滑、详情是铺满屏幕的层。桌面仍是顶栏筛选 + 三栏 + 居中浮层。更窄的 `≤430px` 规则只作用在桌面 DOM 上，窄屏时桌面 DOM 已隐藏。含 Open Graph / Twitter Card 与 `og-share.png` 分享图。
