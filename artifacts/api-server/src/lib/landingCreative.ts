/**
 * One-click AI ad creative for a landing page (/go/<slug>.jpg).
 *
 * The admin "Change picture" button posts the page's name/angle/headline here
 * and gets a brand-new marketing image back — no file picking. Tries
 * gpt-image-1 first (1536x1024 is the card's exact 3:2 ratio), falls back to
 * dall-e-3 for accounts without gpt-image-1 access.
 */

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

// A different art direction each click so repeat presses produce a visibly
// new picture instead of near-duplicates.
const STYLES = [
  "flat vector illustration, bold shapes, generous negative space",
  "sleek 3D render with soft studio lighting",
  "isometric illustration of a city map with glowing location pins",
  "modern gradient abstract with floating map pins and route lines",
  "clean photorealistic desk scene, laptop showing a map with pins",
];

export interface CreativeBrief {
  name: string;
  angle: string;
  headline: string;
}

function buildPrompt(brief: CreativeBrief): string {
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  return [
    "Design a bold, scroll-stopping social-media ad image (3:2 landscape) for a B2B local-business lead-list offer.",
    `Offer angle: "${brief.name}" — ${brief.angle}`,
    `Key message to evoke visually: ${brief.headline}`,
    `Art direction: ${style}. Dark, premium background with a vivid green accent color, subtle map / location-pin motifs, professional modern SaaS marketing aesthetic, strong focal point, high contrast.`,
    "Hard rules: little or no text (a couple of words max, spelled correctly, or none at all); NO fake reviews, star ratings, testimonials, brand names or logos; no phone numbers, no watermarks, no borders.",
  ].join("\n");
}

async function callImagesApi(
  key: string,
  body: Record<string, unknown>,
): Promise<{ mime: string; bytes: Buffer }> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`OpenAI images ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data.");
  const bytes = Buffer.from(b64, "base64");
  // JPEG magic bytes; gpt-image-1 honors output_format, dall-e-3 returns PNG.
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : "image/png";
  return { mime, bytes };
}

export async function generateLandingCreative(brief: CreativeBrief): Promise<{ mime: string; bytes: Buffer }> {
  const key = openAiKey();
  if (!key) {
    throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  }
  const prompt = buildPrompt(brief);
  try {
    return await callImagesApi(key, {
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
      output_format: "jpeg",
    });
  } catch {
    // dall-e-3 has no 3:2 size — 1792x1024 is the closest landscape.
    return await callImagesApi(key, {
      model: "dall-e-3",
      prompt,
      size: "1792x1024",
      quality: "standard",
      response_format: "b64_json",
    });
  }
}
