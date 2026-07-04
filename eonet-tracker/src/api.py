"""Thin client for NASA EONET v3 (https://eonet.gsfc.nasa.gov/api/v3)."""

import requests

BASE = "https://eonet.gsfc.nasa.gov/api/v3"

# EONET category ids (GET /categories):
#   drought, dustHaze, earthquakes, floods, landslides, manmade, seaLakeIce,
#   severeStorms, snow, tempExtremes, volcanoes, waterColor, wildfires


def get_events(status="open", days=None, category=None, source=None,
               limit=None, timeout=60):
    """Fetch events. Returns the list under the 'events' key."""
    params = {"status": status}
    if days:
        params["days"] = days
    if category:
        params["category"] = category
    if source:
        params["source"] = source
    if limit:
        params["limit"] = limit
    resp = requests.get(f"{BASE}/events", params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["events"]


def get_categories(timeout=30):
    resp = requests.get(f"{BASE}/categories", timeout=timeout)
    resp.raise_for_status()
    return resp.json()["categories"]
