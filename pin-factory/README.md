# 📌 Pinterest Home Decor Pin Factory

Automated pipeline that generates **home decor & layout infographic pins**
(AI-generated images in the hand-drawn architect / clean beige infographic
styles), bilingual **PT-BR + EN**, with **affiliate destination links**
(Mercado Livre / Amazon) and a ready-to-upload **Pinterest bulk CSV**.

## How it works

```
topics.json ──► src/generate.py ──► output/images/*.png  (Gemini image API)
                      │
                      └──► output/pins.jsonl (pin database)
                                   │
                     src/export_csv.py ──► output/pins.csv (Pinterest bulk upload)
```

## Setup (once)

1. **Python deps** (run everything from this folder: `cd pin-factory`)
   ```bash
   pip install -r requirements.txt
   ```
2. **API key** — get a free Gemini key at <https://aistudio.google.com/apikey>
   ```bash
   cp .env.example .env   # then paste your key into GEMINI_API_KEY
   ```
   Cost: free tier covers a daily batch; beyond that ≈ US$0.04/image.
3. **Pinterest** — convert your account to a **Business account** (free,
   Settings → Account management) to unlock bulk upload and analytics.

## Daily workflow

```bash
# 1. Generate pins (all pending topics, EN + PT — ~40 images first run)
python -m src.generate                # or --count 10 to start small

# 2. Review output/images/ — delete any image with garbled text and rerun
python -m src.generate --topic bed-placement --force --lang pt

# 3. Build the schedule CSV (5 pins/day starting tomorrow)
python -m src.export_csv

# 4. Publish images so the CSV's Media URLs work
git add output && git commit -m "New pins" && git push

# 5. Pinterest → Create → Bulk create Pins → upload output/pins.csv
```

## Adding content

Append entries to `topics.json`. Three formats:

| format       | style    | example                              |
|--------------|----------|--------------------------------------|
| `do_dont`    | `sketch` | ✔️/❌ split panels (Toilet Ventilation) |
| `floor_plan` | `clean`  | grid of room layouts (10x10 Bedroom)  |
| `tip_list`   | `clean`  | numbered tips (Financial Tips by Age) |

Each topic carries `en` + `pt` text, product keywords for the affiliate
link, and SEO keywords. Keep in-image text **short** — AI models render
short labels far more reliably than sentences.

## Affiliate accounts (sign-up checklist)

| Program | Where | Notes |
|---|---|---|
| Mercado Livre Afiliados | mercadolivre.com.br/afiliados | BR audience; generate links in their portal, paste suffix in `.env` (`ML_AFFILIATE_SUFFIX`) |
| Amazon Associates BR | associados.amazon.com.br | set `AMAZON_BR_TAG`, switch `PT_MARKETPLACE=amazon` if preferred |
| Amazon Associates US | affiliate-program.amazon.com | set `AMAZON_US_TAG`; needs 3 sales in 180 days to stay active |

Until tags are set, links are plain marketplace searches — pins still work.

## Pinterest rules that matter (don't get banned)

- **Affiliate links are allowed**, but **no link shorteners/cloaking**
  (bit.ly etc.) — direct marketplace URLs only, which is what this tool does.
- **Disclose**: every description automatically ends with
  "may contain affiliate links" / "pode conter links de afiliado".
- **Fresh images win**: never re-upload the same image to many boards on the
  same day. 5–10 pins/day, spread through the day (the CSV does this).
- Amazon requires disclosure too and **does not allow** its images to be
  re-hosted — that's why we generate our own art and only *link* out.

## Roadmap (next steps when you're ready)

- [ ] Pinterest API publisher (skip the CSV step) — needs app approval
- [ ] Auto-pick trending topics from Pinterest Trends
- [ ] Per-product pins linking to specific items instead of searches
- [ ] A/B title testing + analytics feedback loop
