# Pin Factory

Generates Pinterest infographic pins for the home-decor niche and monetizes
them with affiliate destination links. Lives in `pin-factory/`.

## Pipeline

`topics.json` (21 bilingual topics) → `src/generate.py` (Gemini image API,
2:3 pins) → `output/pins.jsonl` (pin database) → `src/export_csv.py` →
`output/pins.csv` for Pinterest **Bulk create Pins**.

Run `python -m src.validate` before generating — it lints every topic and
prompt (missing fields, text too long to render cleanly in AI images).

## Pin formats

- `do_dont` — ✔️/❌ split panels in a hand-drawn architect sketch style
- `floor_plan` — grid of top-view room layouts, clean beige infographic
- `tip_list` — numbered tips with small illustrations

Formats and styles are defined in `src/prompts.py`; the reference examples
were Pinterest posts in the @_iarchitect style (see [[Decisions]] 2026-07-04).

## Monetization

- PT pins → Mercado Livre search links (swap in official affiliate links
  from their portal once approved — `ML_AFFILIATE_SUFFIX` in `.env`)
- EN pins → Amazon US search links with the Associates tag
- Every description auto-appends an affiliate disclosure (Pinterest policy;
  no link shorteners, ever)

## Status

- 21 topics validated, 0 pins generated yet (needs `GEMINI_API_KEY` in
  `pin-factory/.env` — free at aistudio.google.com/apikey)
- Affiliate accounts not yet created → links are plain searches until then

Related: [[Dashboard-and-Hosting]] shows generation status live.
