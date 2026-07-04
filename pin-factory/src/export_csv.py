"""Build the Pinterest bulk-upload CSV from output/pins.jsonl.

Usage:
    python -m src.export_csv                     # 5 pins/day starting tomorrow
    python -m src.export_csv --per-day 8
    python -m src.export_csv --start 2026-07-10

Pinterest Business > Create > "Bulk create Pins" accepts this CSV.
Media URL must be PUBLIC — commit & push output/images/ to GitHub and the
default raw.githubusercontent.com base URL will work, or set MEDIA_BASE_URL
in .env to any public host (Cloudinary, S3, etc.).
"""

import argparse
import csv
import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
PINS_DB = ROOT / "output" / "pins.jsonl"
CSV_OUT = ROOT / "output" / "pins.csv"

HEADERS = ["Title", "Media URL", "Pinterest board", "Description", "Link",
           "Publish date", "Keywords"]

# Interleave publish times through the day (Pinterest favors spread-out pins)
SLOTS = ["09:00", "12:30", "15:00", "18:30", "20:00", "21:30", "11:00",
         "16:30", "19:00", "22:00"]


def main() -> int:
    load_dotenv(ROOT / ".env")
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-day", type=int, default=5)
    ap.add_argument("--start", help="first publish date YYYY-MM-DD "
                    "(default: tomorrow)")
    args = ap.parse_args()

    if not PINS_DB.exists():
        print("ERROR: no pins yet — run python -m src.generate first")
        return 1
    if args.per_day > len(SLOTS):
        print(f"NOTE: capping at {len(SLOTS)} pins/day (distinct time slots; "
              f"Pinterest also favors ≤10 fresh pins/day)")
        args.per_day = len(SLOTS)

    base_url = os.getenv(
        "MEDIA_BASE_URL",
        "https://raw.githubusercontent.com/jotinha280404/dasd/"
        "claude/repo-overview-zohgz8/pin-factory",
    ).rstrip("/")

    start = (datetime.strptime(args.start, "%Y-%m-%d").date()
             if args.start else date.today() + timedelta(days=1))

    pins = [json.loads(l) for l in PINS_DB.read_text().splitlines()
            if l.strip()]
    # Alternate languages so each day mixes BR and US audiences
    pins.sort(key=lambda p: (p["topic_id"], p["lang"]))

    with CSV_OUT.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADERS)
        for i, pin in enumerate(pins):
            day = start + timedelta(days=i // args.per_day)
            slot = SLOTS[i % args.per_day]
            writer.writerow([
                pin["title"],
                f"{base_url}/{pin['file']}",
                pin["board"],
                pin["description"],
                pin["link"],
                f"{day} {slot}",
                pin["keywords"],
            ])

    days = (len(pins) + args.per_day - 1) // args.per_day
    print(f"Wrote {len(pins)} pins to {CSV_OUT}")
    print(f"Schedule: {args.per_day}/day starting {start} ({days} days)")
    print("\nUpload: Pinterest Business > Create > Bulk create Pins")
    return 0


if __name__ == "__main__":
    sys.exit(main())
