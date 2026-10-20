# Publish to GitHub Pages

Live URL after push: https://kikikwow.github.io/gossip-dashboard/

## Layout (repo root = Pages site)
- `index.html`, `events/`, `og-share.png`, `.nojekyll` — built site
- `src/` — sources (data, build_dashboard.py, topics.md, …)

## From this box (when gh/CloudAgent has repo push token)
```bash
# Option A: apply prepared tree
rsync -a --delete /tmp/gossip-pub/ /path/to/gossip-dashboard/
cd /path/to/gossip-dashboard && git add -A && git commit -m "Add 网约车 panel + mobile/WeChat" && git push origin main

# Option B: bundle (commit 641fe51 on top of 826cc4d)
git clone https://github.com/kikikwow/gossip-dashboard.git && cd gossip-dashboard
git pull /workspace/gossip-dashboard-update.bundle main
git push origin main
```

CloudAgent workspace historically had `origin` as `https://x-access-token:…@github.com/kikikwow/gossip-dashboard`.

## ⚠️ 2026-10-14 规则（防止覆盖新版）
线上新版「今日吃瓜报」代码以 repo `src/`（build_dashboard.py / dashboard_template.html / board_ui.js / post_ui.js / post.css / detail_render.py / cache_x_posts.py）为准。
内容任务只保存到本地；只有看板定时推送（9:30/11:30/13:30/16:30/23:30）推送，只推数据，且仅在有新数据时推送：只把 data/*.json、*.md、heat_log.csv、topics.md 拷进 repo `src/`，然后在 repo 内 `cd src && python3 build_dashboard.py`（会写 repo 根 index.html 和 events/）。不要用本地 tarball 覆盖 src/*.py、模板或 index.html。
推送前检查：`grep -c 吃瓜报 index.html` ≥1 且含 `board_ui`、`x_cache`。
