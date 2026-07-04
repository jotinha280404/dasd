"""Generate Pinterest pin images with the Gemini image API.

Usage:
    python -m src.generate                  # all topics, both languages
    python -m src.generate --count 5        # only 5 new pins
    python -m src.generate --lang pt        # only Portuguese pins
    python -m src.generate --topic bed-placement --force

Each generated pin is appended to output/pins.jsonl (the pin database);
run `python -m src.export_csv` afterwards to build the Pinterest bulk CSV.
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

from .prompts import build_prompt
from .metadata import (affiliate_link, pin_board, pin_description,
                       pin_keywords, pin_title)

ROOT = Path(__file__).resolve().parent.parent
OUT_IMAGES = ROOT / "output" / "images"
PINS_DB = ROOT / "output" / "pins.jsonl"

API_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
           "{model}:generateContent")


def image_model() -> str:
    # read at call time so load_dotenv() in main() is respected
    return os.getenv("IMAGE_MODEL", "gemini-2.5-flash-image")


def generate_image(prompt: str, api_key: str, retries: int = 3) -> bytes:
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "2:3"},
        },
    }
    url = API_URL.format(model=image_model())
    for attempt in range(1, retries + 1):
        resp = requests.post(url, json=body, timeout=180,
                             headers={"x-goog-api-key": api_key})
        if resp.status_code == 429 and attempt < retries:
            wait = 20 * attempt
            print(f"    rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        for part in data["candidates"][0]["content"]["parts"]:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline:
                return base64.b64decode(inline["data"])
        raise RuntimeError(f"No image in response: {json.dumps(data)[:500]}")
    raise RuntimeError("Rate limited after all retries")


def already_generated() -> set:
    done = set()
    if PINS_DB.exists():
        for line in PINS_DB.read_text().splitlines():
            if line.strip():
                pin = json.loads(line)
                done.add((pin["topic_id"], pin["lang"]))
    return done


def main() -> int:
    load_dotenv(ROOT / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: set GEMINI_API_KEY in .env (free key at "
              "https://aistudio.google.com/apikey)")
        return 1

    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=0,
                    help="max new pins to generate (0 = all pending)")
    ap.add_argument("--lang", choices=["en", "pt", "both"], default="both")
    ap.add_argument("--topic", help="generate only this topic id")
    ap.add_argument("--force", action="store_true",
                    help="regenerate even if the pin already exists")
    args = ap.parse_args()

    topics = json.loads((ROOT / "topics.json").read_text())
    if args.topic:
        topics = [t for t in topics if t["id"] == args.topic]
        if not topics:
            print(f"ERROR: no topic with id '{args.topic}'")
            return 1

    langs = ["en", "pt"] if args.lang == "both" else [args.lang]
    done = set() if args.force else already_generated()
    OUT_IMAGES.mkdir(parents=True, exist_ok=True)

    queue = [(t, lang) for t in topics for lang in langs
             if (t["id"], lang) not in done]
    if args.count:
        queue = queue[:args.count]
    if not queue:
        print("Nothing to generate — all requested pins already exist. "
              "Use --force to regenerate.")
        return 0

    print(f"Generating {len(queue)} pin(s) with {image_model()}...")
    generated = 0
    for topic, lang in queue:
        name = f"{topic['id']}_{lang}.png"
        print(f"  [{generated + 1}/{len(queue)}] {name}")
        try:
            png = generate_image(build_prompt(topic, lang), api_key)
        except Exception as exc:  # keep going; report at the end
            print(f"    FAILED: {exc}")
            continue
        (OUT_IMAGES / name).write_bytes(png)
        pin = {
            "topic_id": topic["id"],
            "lang": lang,
            "file": f"output/images/{name}",
            "title": pin_title(topic, lang),
            "description": pin_description(topic, lang),
            "board": pin_board(topic, lang),
            "link": affiliate_link(topic, lang),
            "keywords": pin_keywords(topic, lang),
        }
        with PINS_DB.open("a") as fh:
            fh.write(json.dumps(pin, ensure_ascii=False) + "\n")
        generated += 1

    print(f"\nDone: {generated}/{len(queue)} pins saved to output/images/")
    print("Next: python -m src.export_csv")
    return 0 if generated == len(queue) else 2


if __name__ == "__main__":
    sys.exit(main())
