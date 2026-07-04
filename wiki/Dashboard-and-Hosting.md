# Dashboard and Hosting

One self-contained `index.html` at the repo root — vanilla JS, no build
step, no external requests except NASA's EONET API (fetched by the
browser). Three workspaces in the navbar:

- **Pin Factory** — topic bank status, generated-pin gallery
  ([[Pin-Factory]])
- **EONET Tracker** — live open events + the latency report
  ([[EONET-Tracker]])
- **Wiki** — renders these pages, wikilinks included

## Homelab deployment

`docker compose up -d` from the repo root:

| Service | What it does |
|---|---|
| `dashboard` | nginx:alpine serving the repo read-only on port **8080**; blocks dotfiles, `.env`, `.git`, `deploy/`; `no-store` on data files |
| `eonet-poller` | runs `python -m src.fetch --watch 15` forever — the always-on poller the latency study needs |
| `pins` (profile `tools`) | on-demand: `docker compose run --rm pins python -m src.generate` |

Update flow: `git pull && docker compose restart eonet-poller` (the
dashboard picks up new files immediately — it's a bind mount).

Security notes: the nginx config denies dotfiles and `.env` patterns, and
the repo is mounted read-only. Still treat it as LAN-only; put your reverse
proxy + auth in front before exposing beyond the LAN (open item in [[Ideas]]).

## Obsidian access

Open the repo root as a vault: `wiki/` is the curated layer (this wiki),
and `graphify-out/obsidian/` (after `graphify export obsidian`) is the
auto-generated code-graph vault. Both coexist fine in one vault window.
