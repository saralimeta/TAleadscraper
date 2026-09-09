"""
TradeAnchor.ai Lead Scraper — backend API.

Wraps the Serper.dev "Google Maps" search endpoint so the frontend never
needs to see or ship the API key. The key is loaded from a local .env file
via python-dotenv and read once at startup; requests fail fast if it's
missing instead of silently hitting Serper with an empty key.
"""

import os
import re

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

SERPER_API_KEY = os.environ.get("SERPER_API_KEY")
SERPER_MAPS_URL = "https://google.serper.dev/maps"
REQUEST_TIMEOUT_SECONDS = 15

# Serper /maps passes through the Google Maps business category as "type"
# (string) and usually "types" (list). Trade-school searches otherwise pull in
# plumbing companies, unions, staffing agencies, etc. that merely mention
# "trade school" — so we keep only places whose category reads as an
# educational institution, and explicitly drop look-alikes.
_EDU_CATEGORY = re.compile(
    r"\b(school|college|univers|academy|institut|training|vocational|education|apprentic|tuition)",
    re.IGNORECASE,
)
_NOT_EDU_CATEGORY = re.compile(
    r"\b(association|non[- ]?profit|nonprofit|foundation|agency|staffing|recruit|consultant|"
    r"contractor|union|chamber of commerce|corporate office|manufacturer|supply|supplier|store)\b",
    re.IGNORECASE,
)


def _is_trade_school(place):
    types = place.get("types") if isinstance(place.get("types"), list) else []
    cats = " ".join(str(c) for c in ([place.get("type")] + types) if c)
    if not cats:
        return False  # no category from Serper -> can't vouch for it, drop
    if _NOT_EDU_CATEGORY.search(cats):
        return False
    return bool(_EDU_CATEGORY.search(cats))

app = Flask(__name__)
CORS(app)


def _format_hours(opening_hours):
    """Normalize Serper's openingHours (dict or list) into a list of strings."""
    if not opening_hours:
        return []
    if isinstance(opening_hours, dict):
        return [f"{day}: {hours}" for day, hours in opening_hours.items()]
    if isinstance(opening_hours, list):
        return [str(entry) for entry in opening_hours]
    return []


def _to_lead(place, fallback_city):
    return {
        "name": place.get("title") or "",
        "address": place.get("address") or "",
        "city": fallback_city,
        "phone": place.get("phoneNumber"),
        "rating": place.get("rating") or 0,
        "reviews": place.get("ratingCount") or 0,
        "website": place.get("website"),
        "hours": _format_hours(place.get("openingHours")),
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "serper_configured": bool(SERPER_API_KEY)})


@app.post("/api/search")
def search():
    if not SERPER_API_KEY:
        return jsonify({"error": "SERPER_API_KEY is not configured on the server"}), 500

    payload = request.get_json(silent=True) or {}
    trade = (payload.get("trade") or "").strip()
    city = (payload.get("city") or "").strip()

    if not trade or not city:
        return jsonify({"error": "Both 'trade' and 'city' are required"}), 400

    query = f"{trade} {city} CA"

    try:
        response = requests.post(
            SERPER_MAPS_URL,
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            json={"q": query},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        return jsonify({"error": f"Serper request failed: {exc}"}), 502

    data = response.json()
    places = data.get("places") or []
    businesses = [
        _to_lead(place, city)
        for place in places
        if place.get("title") and _is_trade_school(place)
    ]

    return jsonify({"businesses": businesses})


if __name__ == "__main__":
    if not SERPER_API_KEY:
        print("WARNING: SERPER_API_KEY not found. Copy .env.example to .env and add your key.")
    app.run(debug=True, port=5000)
