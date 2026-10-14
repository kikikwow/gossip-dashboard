# 内容规则（CONTENT_RULES）

所有上板条目都适用：热榜、事件、动态、线索、短期热点。由 `src/check_content.py` 强制校验，`build_dashboard.py` 末尾会自动运行，CI（`.github/workflows/content-check.yml`）在每次 push 时再跑一遍。**校验失败，构建以非 0 退出，不得推送。**

## 每个条目必须有
1. **事件说明**：至少一句完整的话（≥15 字），说清楚发生了什么，**不能只写标题**，也不能等于公司名或标题。
2. **来源链接**：至少一个 http(s) 链接，事件条目放 `links`，热榜说明放 `sources`。
3. **可信度**：`tag` / `credibility` 取值为 实锤 / 传闻 / 待核实 / 官方 / 统计。
4. **时间**：事件条目填 `date`，热榜说明填 `event_time` 和 `recorded_at`（UTC）。
5. **外语内容**：要有中文译文和原文。条目级用 `lang` + `translation_zh` + `original`；X 帖的译文写进 `src/x_cache.json` 对应帖子的 `translation_zh` 和 `lang`。页面上译文在前，原文可展开。
6. **X 帖必须已缓存**：引用的 `x.com/.../status/ID` 都要在 `src/x_cache.json` 里（构建时 `cache_x_posts.fill_missing()` 会自动补抓）。

## 热榜里没有对应事件的话题
`heat_log.csv` 里每个话题，要么能匹配到某个事件条目（匹配器和前端 `PostUI.matchTopic` 是同一个），要么在 `src/topic_notes.json` 里有一条说明，按话题名精确对应：
```json
"话题名": {"summary": "2-4 句事件说明", "credibility": "实锤", "event_time": "2026-10-13",
          "sources": [{"label": "媒体：标题", "url": "https://..."}], "recorded_at": "2026-10-14T14:20:00Z"}
```
这条说明会显示在热榜浮窗的「这是什么事」区。例行任务新增热榜话题时，要同时写这个文件。

## 缺内容时
**不得编造。** 实在补不了的字段，在条目上写 `"pending": ["待补充：<字段>——<原因>"]`，字段名用：说明 / 来源 / 可信度 / 时间 / 译文 / 缓存。校验会把它当成如实说明的缺口放行，页面也会显示出来。数字、引语、链接只能来自已打开核实过的来源。
