# 🛰️ EONET Event Tracker & Latency Study

Polls **NASA EONET v3** (natural-event tracker: wildfires, severe storms,
volcanoes, floods, sea ice…) and measures the question that decides
whether the data is useful for anything time-sensitive:

> **How long after an event happens does it appear in the API?**

EONET gives every geometry point a `date` (when it happened). What it
*doesn't* tell you is when it became visible. This poller records the
`first_seen` timestamp for every new event/geometry point it observes;
`lag = first_seen − date` is the real-world latency.

## Run it

```bash
cd eonet-tracker
pip install -r requirements.txt

python -m src.fetch                 # single poll (seeds the baseline)
python -m src.fetch --watch 15      # keep polling every 15 min (leave running)
python -m src.latency               # latency report per category
```

Filter to the categories you care about:

```bash
python -m src.fetch --watch 15 --category wildfires,severeStorms,volcanoes,floods
```

Category ids: `drought dustHaze earthquakes floods landslides manmade
seaLakeIce severeStorms snow tempExtremes volcanoes waterColor wildfires`

## Reading the report

- **BACKLOG** = everything the first poll saw at once. Lag numbers there are
  meaningless (events were already old). Ignore them.
- **LIVE** = events/points that *appeared between polls*. This is the true
  ingestion latency. You need to leave `--watch` running for a day or two
  to accumulate a meaningful sample.

## What to expect (so you're not surprised)

EONET is a **curated aggregator** — humans/systems at NASA merge feeds from
sources like IRWIN, InciWeb, GDACS, JTWC and SitRep into clean "events".
Curation costs time; expect lag measured in **hours to days**, not minutes.
The per-category report matters because some lanes (e.g. storms sourced
from JTWC) update faster than others.

If the study confirms it's too slow, the primary sources are the edge:

| Data | Source | Typical latency |
|---|---|---|
| Active fires (satellite) | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | ~3h (NRT), ~30min (URT in some regions) |
| Earthquakes | [USGS FDSN API](https://earthquake.usgs.gov/fdsnws/event/1/) | minutes |
| Multi-hazard alerts | [GDACS](https://www.gdacs.org) | hours |
| US wildfire incidents | IRWIN / InciWeb | hours |

## A note on the betting idea

This project measures data freshness — that part is just public NASA data
and good engineering. Before putting money on prediction markets with it:
**check whether Polymarket (or any market) is legally available where you
live** — it's geo-blocked in several jurisdictions, and using VPNs to dodge
that violates their terms. Also remember market resolution criteria rarely
match "a satellite saw a hotspot" — read how each market resolves before
assuming a data edge is a trading edge.
