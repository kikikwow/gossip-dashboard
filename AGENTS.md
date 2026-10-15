# AGENTS.md — gossip-dashboard 工程约束（所有 agent 开工前必读）

## 项目
「中国大厂八卦 / 滴滴追踪」看板，GitHub Pages：https://kikikwow.github.io/gossip-dashboard/ （repo 根目录就是站点）。
例行任务（滴滴每小时追踪、大厂简报、美股中概简报、快讯、每日总结）产出数据，构建成静态页面。

## 目录
- `index.html`、`events/*.html`、`og-share.png`：**构建产物**，不要手改，也不要用外部产物覆盖。
- `src/build_dashboard.py`：唯一构建入口。会写 `src/dashboard/`、repo 根 `index.html` 和 `events/`。
- `src/dashboard_template.html`、`src/board_ui.js`、`src/post_ui.js`、`src/post.css`、`src/detail_render.py`、`src/cache_x_posts.py`：前端和渲染代码。
- `src/check_content.py`：内容校验（必跑）。`src/check_originals.py`：原文和展开回归检查。
- 数据：`src/data/*.json`（每期内容，另有 `*.md` 简报原文）、`src/heat_log.csv`、`src/topics.md`、`src/x_cache.json`、`src/topic_notes.json`。

## 构建与推送（硬性规则）
1. **只推数据。** 例行任务只能新增或修改数据：`src/data/*`、`src/heat_log.csv`、`src/topics.md`、`src/topic_notes.json`、`src/x_cache.json`。
2. **在 repo 内构建**：`cd src && python3 build_dashboard.py`，用 repo 里的新版脚本。
3. **禁止**用外部脚本、本地 tarball 或旧构建产物覆盖 `src/*.py`、模板、JS/CSS 或 `index.html`。10-14 曾因此把新版冲回旧版（fb0f2d6 / 9d3b809）。要改代码，单独提交并写清原因。
4. **必跑校验**：`build_dashboard.py` 末尾会自动跑 `check_content.py`。非 0 退出就**不得推送**，先修数据或按规则标「待补充」。CI 在 push 时会再跑一遍。
5. 推送前自检：`grep -c 吃瓜报 index.html` ≥1，且页面含 `board_ui`、`x_cache`。

## 已锁定的设计决策（不得回退）
- 「今日吃瓜报」报纸+卡片新版是 PC 和移动端的默认，保留「经典版 / 新版」切换（`?ui=classic|new`，localStorage `gossipUi`）。
- 低对比暖灰米色背景，柔和低饱和配色。
- 导航：头版 | 新线索 | 热榜；移动端底栏：追踪 | 动态 | 热榜。
- 选「全部」时，滴滴追踪置顶在头瓜之前；滴滴命名统一为「滴滴 & 滴滴出海」。
- 热度按时间衰减，过期的头瓜会降级。
- 热榜每一条都能点开：有事件的进承接页，没有事件的在浮窗里显示 `topic_notes.json` 的「这是什么事」说明。
- 引用的 X 帖都要缓存进 `x_cache.json`，浮窗和页面显示缓存原文。
- 外语内容先显示中文译文，原文可展开；长文统一用「展开」。
- 海外小语种线索放单独一栏。
- 时间可在北京时间和 UTC 之间切换，默认北京时间。

## 内容
遵守 [CONTENT_RULES.md](CONTENT_RULES.md)：每个条目都要有说明句、来源、可信度、时间；外语要有译文和原文；X 帖要缓存。**不得编造数据**，缺内容就写「待补充：原因」。

## 发布细节
另见 [PUBLISH.md](PUBLISH.md)（若存在）。冲突时以本文件为准。

## Cloud agent restrictions (user rule, 2026-10-14)
Do NOT open a browser, take screenshots, record screens, review videos, or spawn computerUse/mediaReview/browser subagents. Use only git, shell and scripts; verify with curl/grep/check scripts. Visual acceptance is done outside Cursor by the bot.
