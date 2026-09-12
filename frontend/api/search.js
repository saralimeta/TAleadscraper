// Wraps the Serper.dev "Google Maps" search endpoint so the frontend never
// sees the API key, then persists results to Supabase so they survive
// across sessions/devices.

import { supabase } from "./_supabase.js";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_MAPS_URL = "https://google.serper.dev/maps";

// Serper /maps passes through the Google Maps business category as `type`
// (string) and usually `types` (array).
//
// Only school searches get category-filtered. A trade like "HVAC" or "Plumber"
// is looking for contractors, and every contractor result would be dropped by
// an education filter — so we apply it only when the trade term itself asks
// for a school.
const SCHOOL_SEARCH = /\b(school|training|academy|institute|college|university|apprentice|vocational|education)/i;

// Tested per category, not against all of them joined: a real beauty school is
// often also a "Beauty supply store", and vetoing on the combined string would
// drop it. One clearly educational category is enough to keep a place.
const IS_SCHOOL_CATEGORY = /\b(school|college|univers|academy|institut|training|vocational|education|apprentic)/i;
// Categories carrying an education word that still aren't a school.
const NOT_SCHOOL_CATEGORY = /\b(consultant|association|union|staffing|recruit|agency|supply|supplier|store)\b/i;

function isSchool(place) {
  const categories = [place.type, ...(Array.isArray(place.types) ? place.types : [])].filter(Boolean);
  if (categories.some((c) => !NOT_SCHOOL_CATEGORY.test(c) && IS_SCHOOL_CATEGORY.test(c))) {
    return true;
  }
  // Google's category is sometimes plain wrong ("HVAC Academy Orlando" is
  // filed as an HVAC contractor), so fall back to the business name.
  return SCHOOL_SEARCH.test(place.title || "");
}

function formatHours(openingHours) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours)) return openingHours.map(String);
  if (typeof openingHours === "object") {
    return Object.entries(openingHours).map(([day, hours]) => `${day}: ${hours}`);
  }
  return [];
}

function toLead(place, trade, fallbackCity, county, state, country) {
  return {
    trade,
    name: place.title || "",
    address: place.address || "",
    city: fallbackCity,
    county: county || null,
    state: state || null,
    country: country || null,
    phone: place.phoneNumber || null,
    rating: place.rating || 0,
    reviews: place.ratingCount || 0,
    website: place.website || null,
    hours: formatHours(place.openingHours),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SERPER_API_KEY) {
    return res.status(500).json({ error: "SERPER_API_KEY is not configured on the server" });
  }

  const { trade, city, county, state, country } = req.body || {};
  const tradeTrimmed = (trade || "").trim();
  const cityTrimmed = (city || "").trim();
  const countyTrimmed = (county || "").trim();
  const stateTrimmed = (state || "").trim();
  const countryTrimmed = (country || "").trim();

  // City is optional — a county/state/country still gives Serper a usable
  // location, and leads.city (not-null) falls back to the most specific
  // location term we have.
  const fallbackCity = cityTrimmed || countyTrimmed || stateTrimmed || countryTrimmed;

  if (!tradeTrimmed || !fallbackCity) {
    return res.status(400).json({ error: "'trade' and at least one of city/county/state/country are required" });
  }

  const query = [tradeTrimmed, cityTrimmed, countyTrimmed, stateTrimmed, countryTrimmed]
    .filter(Boolean)
    .join(" ");

  let data;
  try {
    const response = await fetch(SERPER_MAPS_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query }),
    });
    if (!response.ok) {
      throw new Error(`Serper responded with ${response.status}`);
    }
    data = await response.json();
  } catch (err) {
    return res.status(502).json({ error: `Serper request failed: ${err.message}` });
  }

  const schoolSearch = SCHOOL_SEARCH.test(tradeTrimmed);
  const places = data.places || [];
  const businesses = places
    .filter((place) => place.title && (!schoolSearch || isSchool(place)))
    .map((place) => toLead(place, tradeTrimmed, fallbackCity, countyTrimmed, stateTrimmed, countryTrimmed));

  let supabaseError = null;
  if (businesses.length > 0) {
    const { error } = await supabase
      .from("leads")
      .upsert(businesses, { onConflict: "name,city,country,trade" });
    if (error) {
      // Don't fail the request over a persistence error — the scrape itself succeeded.
      console.error("Supabase upsert failed:", error.message);
      supabaseError = error.message;
    }
  }

  return res.status(200).json({ businesses, supabaseError });
}
