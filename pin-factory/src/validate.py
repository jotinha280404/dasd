"""Validate topics.json + every generated prompt before spending API credits.

Usage:
    python -m src.validate

Checks, per topic and language:
- required fields exist for the topic's format
- both 'en' and 'pt' variants are present and complete
- product keywords + SEO keywords exist
- in-image text is short enough to render reliably (AI models garble
  long strings; short labels come out clean)
- the final prompt builds without errors
"""

import json
import sys
from pathlib import Path

from .prompts import build_prompt

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_BY_FORMAT = {
    "do_dont": ["title", "right", "right_scene", "wrong", "wrong_scene"],
    "floor_plan": ["title", "plans"],
    "tip_list": ["title", "tips"],
}
# In-image text limits (characters). Captions/labels beyond this tend to
# come out garbled or truncated in generated images.
MAX_TITLE = 40
MAX_CAPTION = 55
MAX_LABEL = 25
MAX_TIPS = 6  # more than this and each section gets too small to read


def check_topic(t: dict) -> list:
    problems = []
    fmt = t.get("format")
    if fmt not in REQUIRED_BY_FORMAT:
        return [f"unknown format '{fmt}'"]
    for key in ("id", "room", "products"):
        if not t.get(key):
            problems.append(f"missing '{key}'")
    for lang in ("en", "pt"):
        v = t.get(lang)
        if not v:
            problems.append(f"missing '{lang}' variant")
            continue
        for field in REQUIRED_BY_FORMAT[fmt]:
            if not v.get(field):
                problems.append(f"{lang}: missing '{field}'")
        if not t.get(f"keywords_{lang}"):
            problems.append(f"missing 'keywords_{lang}'")
        # text-length lint (warnings that are still listed as problems
        # only when wildly over budget)
        if v.get("title") and len(v["title"]) > MAX_TITLE:
            problems.append(f'{lang}: title too long ({len(v["title"])} chars '
                            f'> {MAX_TITLE}): "{v["title"]}"')
        for cap_field in ("right", "wrong"):
            cap = v.get(cap_field)
            if cap and len(cap) > MAX_CAPTION:
                problems.append(f'{lang}: {cap_field} caption too long '
                                f'({len(cap)} > {MAX_CAPTION}): "{cap}"')
        for item in v.get("tips", []) + v.get("plans", []):
            label = item.get("label") or item.get("name") or ""
            if len(label) > MAX_LABEL:
                problems.append(f'{lang}: label too long ({len(label)} > '
                                f'{MAX_LABEL}): "{label}"')
        if len(v.get("tips", [])) > MAX_TIPS:
            problems.append(f"{lang}: {len(v['tips'])} tips (> {MAX_TIPS})")
    prods = t.get("products", {})
    for k in ("amazon_en", "amazon_pt", "ml_pt"):
        if not prods.get(k):
            problems.append(f"products: missing '{k}'")
    # finally: does the prompt actually build?
    for lang in ("en", "pt"):
        if t.get(lang):
            try:
                build_prompt(t, lang)
            except Exception as exc:
                problems.append(f"{lang}: prompt build failed: {exc}")
    return problems


def main() -> int:
    topics = json.loads((ROOT / "topics.json").read_text())
    ids = [t.get("id") for t in topics]
    bad = 0
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        print(f"✗ duplicate topic ids: {sorted(dupes)}")
        bad += 1
    for t in topics:
        problems = check_topic(t)
        if problems:
            bad += 1
            print(f"✗ {t.get('id', '???')}")
            for p in problems:
                print(f"    - {p}")
    if bad:
        print(f"\n{bad} topic(s) with problems, "
              f"{len(topics) - bad}/{len(topics)} clean.")
        return 1
    print(f"✓ all {len(topics)} topics valid "
          f"({len(topics) * 2} pins ready to generate)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
