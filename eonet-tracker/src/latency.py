"""Latency report: how stale is EONET data by the time we can see it?

Reads data/observations.jsonl (built by src.fetch) and prints, per
category, the distribution of `lag_hours` = first_seen - geom_date.

IMPORTANT: only observations where new_event=True AND collected after the
first poll are meaningful for "how fast do events appear" — the very first
poll sees the whole backlog at once, which inflates lag. The report
separates the two.

Usage:
    python -m src.latency
"""

import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OBS = ROOT / "data" / "observations.jsonl"


def pct(values, p):
    values = sorted(values)
    idx = min(len(values) - 1, max(0, round(p / 100 * (len(values) - 1))))
    return values[idx]


def report(rows, label):
    print(f"\n=== {label} ({len(rows)} observations) ===")
    if not rows:
        print("  (none yet — keep the poller running)")
        return
    by_cat = {}
    for r in rows:
        by_cat.setdefault(r["category"], []).append(r["lag_hours"])
    print(f"  {'category':<16}{'n':>5}{'median h':>10}{'p90 h':>8}{'min h':>8}")
    for cat, lags in sorted(by_cat.items()):
        print(f"  {cat:<16}{len(lags):>5}"
              f"{statistics.median(lags):>10.1f}"
              f"{pct(lags, 90):>8.1f}"
              f"{min(lags):>8.1f}")


def main() -> int:
    if not OBS.exists():
        print("No observations yet — run: python -m src.fetch --watch 15")
        return 1
    rows = [json.loads(l) for l in OBS.read_text().splitlines() if l.strip()]

    backlog = [r for r in rows if r.get("backlog")]
    live = [r for r in rows if not r.get("backlog")]

    report(backlog, "BACKLOG (first poll — lag numbers NOT meaningful)")
    report(live, "LIVE (seen appearing in real time — the numbers that matter)")

    if live:
        lags = [r["lag_hours"] for r in live]
        med = statistics.median(lags)
        print(f"\nVerdict: median event-to-API lag ≈ {med:.1f}h.")
        if med > 6:
            print("  EONET is a curated daily-ish aggregator — too slow for "
                  "time-sensitive use.\n  For near-real-time, poll the primary "
                  "sources directly:\n"
                  "    fires:       NASA FIRMS (~3h)   firms.modaps.eosdis.nasa.gov\n"
                  "    earthquakes: USGS (~minutes)    earthquake.usgs.gov/fdsnws/event/1/\n"
                  "    storms/all:  GDACS (~hours)     gdacs.org\n"
                  "    US wildfires: IRWIN/InciWeb feeds")
        else:
            print("  Surprisingly fresh — worth segmenting by category and "
                  "source to find the fast lanes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
