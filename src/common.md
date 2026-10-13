# 所有八卦相关定时任务的通用规则（每次运行先读本文件和 topics.md）

1. 先读 /workspace/gossip-tracking/topics.md。
2. 长期重点话题（滴滴及滴滴出海、字节、中国大模型）：每期都要专门搜索，在 Top 3 之后单独开一个 "## 🎯 重点追踪" 栏目，按话题分组列出新进展；没有新内容的话题就写一句"本期无新动态"。
3. 短期热点话题：由你自己判断，选当前最热、话题度最高、争议最大的新事件，要有真实的热度数据支撑（X 发帖量 get_posts_counts_recent、帖子浏览量和转发量、微博热搜排名）。每次运行都要更新 topics.md 里的短期列表：新加话题、刷新热度数据，热度明显回落或 3–5 天没有新进展的就移出。在简报里开一个 "## ⚡ 短期热点追踪" 栏目，每个话题写一行最新进展，加上热度趋势（📈 升温 / 📉 降温 / ➡️ 持平）；本期新加入或被移出的话题要注明。
4. 把用到的热度数据追加到 /workspace/gossip-tracking/heat_log.csv（列：timestamp_utc,topic,metric,value,source）。
5. 把这一期的内容以结构化 JSON 追加保存到 /workspace/gossip-tracking/data/（如果有看板生成脚本 /workspace/gossip-tracking/build_dashboard.py，就运行它刷新看板页面）。
6. 时间窗口只看上次运行以来的新内容。不用用户的个人 X 时间线。不编造任何信息，每条都带链接，并标注【实锤】或【传闻】和信源类型。
