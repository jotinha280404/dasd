import type {
  AspectRatioValue,
  ImageGenInput,
  ImageGenResult,
  ImageProvider,
  MediaAsset,
} from "@dasd/higg-shared";
import { aspectSize, writeMedia } from "../../store/media";
import { clampCount } from "./common";

/**
 * The keyless placeholder provider: renders a cinematic SVG card sized to the
 * requested aspect ratio, with the prompt wrapped over a dark gradient and an
 * "add GEMINI_API_KEY" mark. Deterministic-ish (colour + glow derive from the
 * prompt) so the same prompt looks stable across runs. Lets the whole UI work
 * with no API key.
 */
export class StubImageProvider implements ImageProvider {
  readonly id = "stub";
  readonly defaultModel = "placeholder-svg";
  readonly isStub = true;

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    const aspectRatio = input.aspectRatio ?? "1:1";
    const count = clampCount(input.count);
    const { width, height } = aspectSize(aspectRatio);
    const assets: MediaAsset[] = [];
    for (let i = 0; i < count; i++) {
      const svg = renderPlaceholderSvg(input.prompt, aspectRatio, i);
      assets.push(
        writeMedia({
          bytes: new Uint8Array(Buffer.from(svg, "utf8")),
          mimeType: "image/svg+xml",
          width,
          height,
        }),
      );
    }
    return { assets, provider: this.id, model: this.defaultModel, costUsd: 0 };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** FNV-1a — a cheap, stable hash so colours are deterministic per prompt. */
function hashInt(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Greedy word-wrap into at most `maxLines` lines, ellipsising any overflow. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i] ?? "";
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        current = "";
        break;
      }
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
    i = words.length;
  }
  if (i < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    if (last !== undefined) lines[lines.length - 1] = `${last} …`;
  }
  return lines;
}

function renderPlaceholderSvg(prompt: string, aspectRatio: AspectRatioValue, variant: number): string {
  const { width, height } = aspectSize(aspectRatio);
  const seed = hashInt(`${prompt}#${variant}`);
  const hue = seed % 360;
  const hue2 = (hue + 45) % 360;
  const glowX = 20 + (seed % 60);
  const glowY = 18 + ((seed >> 4) % 55);

  const fontSize = Math.max(22, Math.round(width * 0.05));
  const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.55)));
  const lines = wrapText(prompt.trim() || "your prompt here", maxChars, 5);
  const lineHeight = Math.round(fontSize * 1.32);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round(height / 2 - blockHeight / 2 + fontSize * 0.7);
  const cx = Math.round(width / 2);

  const textEls = lines
    .map(
      (line, idx) =>
        `<text x="${cx}" y="${startY + idx * lineHeight}" font-family="'Segoe UI', system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="#f4f4f5" fill-opacity="${idx === 0 ? "1" : "0.9"}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");

  const markFont = Math.max(13, Math.round(width * 0.021));
  const label = escapeXml(aspectRatio);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="placeholder image">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 42%, 13%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 22) % 360}, 36%, 8%)"/>
      <stop offset="1" stop-color="hsl(${hue2}, 46%, 5%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="${glowX}%" cy="${glowY}%" r="75%">
      <stop offset="0" stop-color="hsl(${hue2}, 88%, 62%)" stop-opacity="0.32"/>
      <stop offset="1" stop-color="hsl(${hue2}, 88%, 62%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${Math.round(fontSize * 0.7)}" y="${Math.round(fontSize * 1.1)}" font-family="'Segoe UI', system-ui, sans-serif" font-size="${markFont}" font-weight="700" letter-spacing="2" fill="#ffffff" fill-opacity="0.5">STUB · ${label}</text>
  ${textEls}
  <text x="${cx}" y="${height - Math.round(markFont * 1.8)}" font-family="'Segoe UI', system-ui, sans-serif" font-size="${markFont}" letter-spacing="1.5" fill="#f4f4f5" fill-opacity="0.68" text-anchor="middle">PLACEHOLDER · ADD GEMINI_API_KEY</text>
</svg>`;
}
