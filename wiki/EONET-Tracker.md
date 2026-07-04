# EONET Tracker

Polls NASA EONET v3 (natural events: wildfires, severe storms, volcanoes,
floods…) and measures **ingestion latency** — the gap between when an event
happened (`geometry.date`) and when it became visible to a poller
(`first_seen`). Lives in `eonet-tracker/`.

## Why latency is the whole question

The motivating idea ([[Ideas]]) needs *fresh* data. EONET is a curated
aggregator (IRWIN, InciWeb, GDACS, JTWC feeds merged by NASA), and curation
costs time — the hypothesis is lag in hours-to-days. Only measuring settles it.

## How to run the study

```
python -m src.fetch --watch 15        # leave running (homelab poller does this)
python -m src.latency                 # per-category lag report
```

The first poll sees the whole backlog at once, so those lag numbers are
meaningless; only events observed *appearing between polls* count. Records
carry a `backlog` flag and the report separates the two — trust only LIVE.

## If EONET proves too slow

Primary sources are the fallback edge: USGS earthquakes (~minutes),
NASA FIRMS fires (~3h), GDACS multi-hazard (~hours). Details in
`eonet-tracker/README.md`.

Related: the homelab poller in [[Dashboard-and-Hosting]] accumulates the
observations; results appear on the dashboard's Latency section.
