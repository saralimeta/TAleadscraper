// Wraps the Serper.dev "Google Maps" search endpoint so the frontend never
// sees the API key, then persists results to Supabase so they survive
// across sessions/devices.

import { supabase } from "./_supabase.js";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_MAPS_URL = "https://google.serper.dev/maps";

function formatHours(openingHours) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours)) return openingHours.map(String);
  if (typeof openingHours === "object") {
    return Object.entries(openingHours).map(([day, hours]) => `${day}: ${hours}`);
  }
  return [];
}

function toLead(place, trade, fallbackCity, county, country) {
  return {
    trade,
    name: place.title || "",
    address: place.address || "",
    city: fallbackCity,
    county: county || null,
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

  const { trade, city, county, country } = req.body || {};
  const tradeTrimmed = (trade || "").trim();
  const cityTrimmed = (city || "").trim();
  const countyTrimmed = (county || "").trim();
  const countryTrimmed = (country || "").trim();

  if (!tradeTrimmed || !cityTrimmed) {
    return res.status(400).json({ error: "Both 'trade' and 'city' are required" });
  }

  const query = [tradeTrimmed, cityTrimmed, countyTrimmed, countryTrimmed]
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

  const places = data.places || [];
  const businesses = places
    .filter((place) => place.title)
    .map((place) => toLead(place, tradeTrimmed, cityTrimmed, countyTrimmed, countryTrimmed));

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
