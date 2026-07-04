"""Poll EONET and record WHEN we first saw each event/geometry point.

This is the core of the latency study: EONET tells you when an event
*happened* (geometry date); only a poller like this can tell you when it
became *visible* in the API. The gap between the two is the latency that
decides whether this data is useful for any time-sensitive purpose.

Usage:
    python -m src.fetch                    # one poll of all open events
    python -m src.fetch --category wildfires,severeStorms
    python -m src.fetch --watch 15         # poll every 15 minutes, Ctrl+C to stop

Data model (data/observations.jsonl, append-only):
    one line per NEW geometry point observed, with:
      event_id, title, category, geom_date (when it happened),
      first_seen (when WE first saw it), lag_hours, magnitude, coords
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from .api import get_events

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OBS = DATA / "observations.jsonl"
STATE = DATA / "state.json"


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"seen_geoms": {}}  # event_id -> list of geometry dates already seen


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state))


def iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_date(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def poll(categories=None) -> int:
    state = load_state()
    seen = state["seen_geoms"]
    is_first_poll = not state.get("seeded", False)
    now = iso_now()
    now_dt = parse_date(now)
    new_records = []

    events = get_events(status="open",
                        category=",".join(categories) if categories else None)
    for ev in events:
        ev_id = ev["id"]
        cats = [c["id"] for c in ev.get("categories", [])]
        known = set(seen.get(ev_id, []))
        is_new_event = ev_id not in seen
        for geom in ev.get("geometry", []):
            gdate = geom["date"]
            if gdate in known:
                continue
            known.add(gdate)
            lag_h = round((now_dt - parse_date(gdate)).total_seconds() / 3600, 2)
            new_records.append({
                "event_id": ev_id,
                "backlog": is_first_poll,
                "new_event": is_new_event,
                "title": ev.get("title"),
                "category": cats[0] if cats else "unknown",
                "geom_date": gdate,
                "first_seen": now,
                "lag_hours": lag_h,
                "magnitude": geom.get("magnitudeValue"),
                "magnitude_unit": geom.get("magnitudeUnit"),
                "coords": geom.get("coordinates"),
                "sources": [s.get("id") for s in ev.get("sources", [])],
            })
            is_new_event = False
        seen[ev_id] = sorted(known)

    if new_records:
        DATA.mkdir(exist_ok=True)
        with OBS.open("a") as fh:
            for rec in new_records:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    state["seeded"] = True
    save_state(state)

    fresh_events = sum(1 for r in new_records if r["new_event"])
    print(f"[{now}] {len(events)} open events | "
          f"{fresh_events} new events, {len(new_records)} new geometry points")
    for rec in new_records:
        if rec["new_event"]:
            mag = (f' {rec["magnitude"]}{rec["magnitude_unit"] or ""}'
                   if rec["magnitude"] else "")
            print(f'  NEW  {rec["category"]:<14} {rec["title"]}{mag} '
                  f'(happened {rec["lag_hours"]}h ago)')
    return len(new_records)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--category",
                    help="comma-separated EONET category ids, e.g. "
                         "wildfires,severeStorms,volcanoes,floods")
    ap.add_argument("--watch", type=int, metavar="MINUTES",
                    help="keep polling every N minutes")
    args = ap.parse_args()
    cats = args.category.split(",") if args.category else None

    if not args.watch:
        poll(cats)
        return 0
    print(f"Watching every {args.watch}min — Ctrl+C to stop. "
          f"Run `python -m src.latency` anytime for the report.")
    while True:
        try:
            poll(cats)
        except Exception as exc:  # network hiccup: log and keep watching
            print(f"  poll failed ({exc}), retrying next cycle")
        time.sleep(args.watch * 60)


if __name__ == "__main__":
    sys.exit(main())
