"""Builds image-generation prompts that reproduce the two pin styles:

- "sketch": hand-drawn architect's do/don't diagrams (like @_iarchitect)
- "clean":  minimalist beige infographic / floor-plan boards
"""

SKETCH_STYLE = (
    "Hand-drawn architectural sketch illustration in black ink on a warm "
    "off-white paper background. Hand-lettered casual capital letters for all "
    "text. Thin annotation arrows pointing at details. Subtle watercolor-style "
    "color accents only (soft beige walls, muted tones). A bold GREEN check "
    "mark over the correct example and a bold RED X over the wrong example. "
    "Educational, charming, imperfect linework like a architect's notebook. "
    "Vertical 2:3 Pinterest pin composition with the title at the very top. "
    "No watermark, no signature, no logo."
)

CLEAN_STYLE = (
    "Clean minimalist infographic in a warm beige, cream and taupe palette. "
    "Flat vector style, elegant thin-line icons, generous white space, "
    "modern editorial typography with a bold title at the top. Looks like a "
    "premium interior-design magazine page. Vertical 2:3 Pinterest pin "
    "composition. No watermark, no signature, no logo."
)

TEXT_RULES = (
    "\n\nIMPORTANT TEXT RULES: Render every quoted text EXACTLY as written, "
    "letter by letter, with correct accents. Do not add any other words, "
    "labels or numbers that are not listed here. Keep all text large and "
    "readable."
)


def build_prompt(topic: dict, lang: str) -> str:
    t = topic[lang]
    fmt = topic["format"]
    style = SKETCH_STYLE if topic.get("style") == "sketch" else CLEAN_STYLE

    if fmt == "do_dont":
        body = (
            f'{style}\n\n'
            f'Title at the top: "{t["title"]}"\n\n'
            f'The image is split into two stacked panels:\n'
            f'TOP PANEL (correct, green check mark): {t["right_scene"]}. '
            f'Caption below it: "{t["right"]}"\n\n'
            f'BOTTOM PANEL (wrong, red X): {t["wrong_scene"]}. '
            f'Caption below it: "{t["wrong"]}"'
        )
    elif fmt == "floor_plan":
        plans = "\n".join(
            f'- Panel "{p["name"]}": top-view floor plan showing {p["desc"]}, '
            f"furniture drawn as simple flat shapes with small labels"
            for p in t["plans"]
        )
        body = (
            f'{style}\n\n'
            f'Title at the top: "{t["title"]}"\n\n'
            f'A grid of {len(t["plans"])} small square floor-plan diagrams, '
            f'each inside a thin-lined room outline with a door arc and '
            f'window marks:\n{plans}'
        )
    elif fmt == "tip_list":
        tips = "\n".join(
            f'- "{tip["label"]}": small illustration of {tip["desc"]}'
            for tip in t["tips"]
        )
        body = (
            f'{style}\n\n'
            f'Title at the top: "{t["title"]}"\n\n'
            f'A vertical list of {len(t["tips"])} numbered sections, each '
            f'with a bold label, a small matching illustration and one short '
            f'line of description:\n{tips}'
        )
    else:
        raise ValueError(f"Unknown format: {fmt}")

    return body + TEXT_RULES
