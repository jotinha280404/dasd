# Projects

Monorepo with two independent projects — `cd` into one and follow its README.

| Project | What it is |
|---|---|
| [`pin-factory/`](pin-factory/) | 📌 Pinterest home-decor pin generator: AI images (Gemini) + affiliate links (Mercado Livre / Amazon) + bulk-upload CSV |
| [`eonet-tracker/`](eonet-tracker/) | 🛰️ NASA EONET natural-event poller + API latency study (wildfires, storms, volcanoes…) |

## Dashboard

One dashboard, both workspaces, with a navbar to switch between them:

```bash
python -m http.server 8000     # from the repo root
# open http://localhost:8000
```

- **📌 Pin Factory** — topic bank status, generated-pin gallery, PT/EN counters
- **🛰️ EONET Tracker** — live open events straight from NASA's API (fetched by
  your browser), category filter, and the latency-study report once the
  poller has data
