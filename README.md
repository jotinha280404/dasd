# Workspaces

Monorepo with two products, a dashboard over both, and a Claude-maintained
wiki. `CLAUDE.md` is the schema — read it first.

| What | Where |
|---|---|
| 📌 Pinterest pin generator (AI images + affiliate links + bulk CSV) | [`pin-factory/`](pin-factory/) |
| 🛰️ NASA EONET event poller + latency study | [`eonet-tracker/`](eonet-tracker/) |
| 🖥️ Dashboard (Pin Factory · EONET · Wiki tabs) | [`index.html`](index.html) |
| 📖 Wiki — decisions, ideas, project pages | [`wiki/`](wiki/) |

## Run the dashboard

**Homelab (recommended):**

```bash
docker compose up -d
# dashboard → http://<host>:8080
# eonet-poller runs `fetch --watch 15` 24/7 (feeds the latency study)
```

nginx serves the repo read-only and blocks dotfiles/`.env`/`.git`. Still
LAN-only by default — put a reverse proxy + auth in front to go further.

**Quick local:**

```bash
python -m http.server 8000    # from the repo root → http://localhost:8000
```

## Wiki / Obsidian

- `wiki/` is the curated knowledge base (Karpathy LLM-wiki pattern; Claude
  keeps it updated — workflows in `CLAUDE.md`). Browse it on the dashboard's
  **Wiki** tab or open the repo root as an **Obsidian vault**.
- `graphify-out/` is the automatic code knowledge graph
  ([Graphify](https://github.com/safishamsi/graphify)):
  `graph.html` is interactive; rebuild + Obsidian-export with:

```bash
pip install graphifyy          # PyPI package is graphifyy, CLI is graphify
graphify update .              # rebuild graph (code-only, no API key needed)
graphify export obsidian       # writes graphify-out/obsidian/ — open as a vault
```

## Everyday commands

```bash
# pins
cd pin-factory
python -m src.validate                 # lint all topics/prompts first
python -m src.generate --count 10     # needs GEMINI_API_KEY in .env
python -m src.export_csv               # → output/pins.csv for Pinterest bulk upload

# eonet (if not using docker)
cd eonet-tracker
python -m src.fetch --watch 15         # poller
python -m src.latency                  # report

# pins inside docker instead
docker compose run --rm pins python -m src.generate --count 10
```
