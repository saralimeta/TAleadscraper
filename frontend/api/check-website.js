import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { supabase } from "./_supabase.js";

const SCREENSHOT_TIMEOUT_MS = 20000;
// Claude's vision resolution ceiling is 2576px on the long edge; images
// beyond that get downscaled by the API, wasting the extra page length
// on unreadable pixels. Capping here keeps every byte we send useful.
const MAX_SCREENSHOT_HEIGHT = 2560;

const anthropic = new Anthropic();

const JUDGE_PROMPT = `You're looking at a screenshot of a live small-business website. Judge ONLY its visual design and layout — not the business itself — to decide whether it looks modern or outdated. We're using this to identify businesses that would benefit from a website redesign.

Consider: typography, color palette, spacing/whitespace, image quality, layout structure, and whether the design looks like it would work well on mobile.

Respond with:
- "status": "modern" (looks current, professional, well-designed) or "outdated" (looks dated, cluttered, unattractive, or otherwise in need of a redesign — if it's not clearly modern, call it outdated)
- "score": 0 (very modern) to 10 (very outdated)
- "signals": 2-4 short, specific visual reasons for your verdict (e.g. "cluttered layout with no whitespace", "dated gradient/button style", "tiny hard-to-read body text")`;

function normalizeUrl(website) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

async function captureScreenshot(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREENSHOT_TIMEOUT_MS);
  const shotUrl =
    "https://api.screenshotone.com/take?" +
    new URLSearchParams({
      access_key: process.env.SCREENSHOT_API_KEY,
      url,
      viewport_width: "1280",
      viewport_height: "832",
      full_page: "true",
      format: "png",
      block_ads: "true",
      block_cookie_banners: "true",
      block_trackers: "true",
      cache: "false",
    });

  try {
    const res = await fetch(shotUrl, { signal: controller.signal });
    if (!res.ok) {
      // 401/403/429 usually mean the screenshot provider itself rejected
      // the request (bad key, rate limit) rather than the target site
      // being unreachable — worth distinguishing in the UI.
      const blocked = [401, 403, 429].includes(res.status);
      return { ok: false, blocked, status: res.status };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const capped = await capScreenshotHeight(buf);
    return { ok: true, base64: capped.toString("base64") };
  } catch {
    return { ok: false, blocked: false };
  } finally {
    clearTimeout(timer);
  }
}

// Full-page captures can run to many thousands of pixels tall on long
// sites; crop to the top MAX_SCREENSHOT_HEIGHT rather than shipping a
// huge image Claude would just downscale anyway.
async function capScreenshotHeight(buf) {
  const image = sharp(buf);
  const { width, height } = await image.metadata();
  if (!height || height <= MAX_SCREENSHOT_HEIGHT) return buf;
  return image
    .extract({ left: 0, top: 0, width, height: MAX_SCREENSHOT_HEIGHT })
    .png()
    .toBuffer();
}

async function judgeScreenshot(base64) {
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 512,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["modern", "outdated"],
            },
            score: { type: "integer" },
            signals: { type: "array", items: { type: "string" } },
          },
          required: ["status", "score", "signals"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          { type: "text", text: JUDGE_PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return { status: "unreachable", score: null, signals: ["Analysis declined"] };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  return JSON.parse(textBlock.text);
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
  const shot = await captureScreenshot(url);

  let result;
  if (!shot.ok) {
    result = shot.blocked
      ? {
          status: "blocked",
          score: null,
          signals: [`Screenshot service rejected the request (HTTP ${shot.status})`],
        }
      : {
          status: "unreachable",
          score: null,
          signals: ["Could not capture a screenshot — site may be down"],
        };
  } else {
    try {
      result = await judgeScreenshot(shot.base64);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
