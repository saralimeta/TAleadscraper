import * as cheerio from "cheerio";
import { supabase } from "./_supabase.js";

const FETCH_TIMEOUT_MS = 8000;
const STALE_COPYRIGHT_YEARS = 6;
const USER_AGENT =
  "Mozilla/5.0 (compatible; TradeAnchorBot/1.0; +https://tradeanchor.ai)";

const OLD_GENERATORS = [
  "frontpage",
  "adobe muse",
  "dreamweaver",
  "microsoft word",
];

function normalizeUrl(website) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      return { ok: false };
    }
    const html = await res.text();
    return { ok: true, html, finalUrl: res.url };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function analyzeHtml(html, finalUrl) {
  const $ = cheerio.load(html);
  const signals = [];
  let score = 0;

  if ($('meta[name="viewport"]').length === 0) {
    signals.push("Not mobile-friendly (no viewport tag)");
    score += 3;
  }

  if (!/^https:\/\//i.test(finalUrl)) {
    signals.push("No HTTPS");
    score += 2;
  }

  if ($("marquee, frameset, font, center").length > 0) {
    signals.push("Deprecated markup (marquee/frameset/font/center)");
    score += 2;
  }

  const bodyHtml = $.html();
  const hasFlash =
    /\.swf(\W|$)/i.test(bodyHtml) ||
    $('object[type="application/x-shockwave-flash"]').length > 0;
  if (hasFlash) {
    signals.push("References Flash content");
    score += 3;
  }

  const bodyText = $("body").text();
  const years = [...bodyText.matchAll(/©\s*(\d{4})/g)].map((m) =>
    parseInt(m[1], 10)
  );
  if (years.length > 0) {
    const maxYear = Math.max(...years);
    const currentYear = new Date().getFullYear();
    if (currentYear - maxYear >= STALE_COPYRIGHT_YEARS) {
      signals.push(`Old copyright year (${maxYear})`);
      score += 2;
    }
  }

  const generator = $('meta[name="generator"]').attr("content") || "";
  if (OLD_GENERATORS.some((g) => generator.toLowerCase().includes(g))) {
    signals.push(`Old site-builder tooling (${generator})`);
    score += 2;
  }

  const status = score >= 5 ? "outdated" : score >= 2 ? "needs_update" : "modern";
  return { status, score, signals };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, website } = req.body || {};
  if (!id || !website) {
    return res.status(400).json({ error: "id and website are required" });
  }

  const url = normalizeUrl(website);
  const fetched = await fetchHtml(url);

  const result = fetched.ok
    ? analyzeHtml(fetched.html, fetched.finalUrl)
    : { status: "unreachable", score: null, signals: ["Site did not respond"] };

  const patch = {
    website_status: result.status,
    website_score: result.score,
    website_signals: result.signals,
    website_checked_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ id, ...patch });
}
