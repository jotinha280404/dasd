"""Builds pin metadata: SEO title, description, destination (affiliate) link.

Affiliate links are search links with your tag from .env. Until your
accounts are approved they simply work as plain search links.
"""

import os
from urllib.parse import quote_plus

DISCLOSURE = {
    "en": "This pin may contain affiliate links.",
    "pt": "Este pin pode conter links de afiliado.",
}

CTA = {
    "en": "Save this pin for your next home project! 📌",
    "pt": "Salve este pin para o seu próximo projeto em casa! 📌",
}

BOARDS = {
    "en": {
        "bathroom": "Bathroom Ideas",
        "kitchen": "Kitchen Ideas",
        "bedroom": "Bedroom Ideas",
        "living": "Living Room Ideas",
        "studio": "Small Space Living",
        "entryway": "Home Organization",
        "small-spaces": "Small Space Living",
    },
    "pt": {
        "bathroom": "Ideias para Banheiro",
        "kitchen": "Ideias para Cozinha",
        "bedroom": "Ideias para Quarto",
        "living": "Ideias para Sala",
        "studio": "Kitnet e Studio",
        "entryway": "Organização da Casa",
        "small-spaces": "Espaços Pequenos",
    },
}


def affiliate_link(topic: dict, lang: str) -> str:
    """Destination URL for the pin. PT pins point to Mercado Livre (or
    Amazon BR), EN pins to Amazon US."""
    products = topic["products"]
    if lang == "pt":
        ml_ref = os.getenv("ML_AFFILIATE_SUFFIX", "")
        if os.getenv("PT_MARKETPLACE", "ml") == "amazon":
            tag = os.getenv("AMAZON_BR_TAG", "SEUTAG-20")
            kw = quote_plus(products["amazon_pt"])
            return f"https://www.amazon.com.br/s?k={kw}&tag={tag}"
        # Mercado Livre category/search URL; replace with the official
        # affiliate link generated in the ML affiliates portal when approved.
        return f"https://lista.mercadolivre.com.br/{products['ml_pt']}{ml_ref}"
    tag = os.getenv("AMAZON_US_TAG", "YOURTAG-20")
    kw = quote_plus(products["amazon_en"])
    return f"https://www.amazon.com/s?k={kw}&tag={tag}"


def pin_title(topic: dict, lang: str) -> str:
    return topic[lang]["title"].title() if lang == "en" else topic[lang]["title"].capitalize()


def pin_description(topic: dict, lang: str) -> str:
    kw = topic[f"keywords_{lang}"]
    if topic["format"] == "do_dont":
        lead = {
            "en": f"✔️ {topic['en']['right']} — ❌ {topic['en']['wrong']}.",
            "pt": f"✔️ {topic['pt']['right']} — ❌ {topic['pt']['wrong']}.",
        }[lang]
    elif topic["format"] == "tip_list":
        labels = ", ".join(t["label"].capitalize() for t in topic[lang]["tips"][:3])
        lead = {"en": f"Ideas inside: {labels} and more.",
                "pt": f"Ideias no pin: {labels} e mais."}[lang]
    else:
        lead = {"en": "Practical layouts you can copy at home.",
                "pt": "Layouts práticos para copiar em casa."}[lang]
    return f"{lead} {CTA[lang]} | {kw} | {DISCLOSURE[lang]}"


def pin_board(topic: dict, lang: str) -> str:
    return BOARDS[lang].get(topic["room"], BOARDS[lang]["small-spaces"])


def pin_keywords(topic: dict, lang: str) -> str:
    return topic[f"keywords_{lang}"]
