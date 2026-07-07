import type {
  MediaAsset,
  MotionTypeValue,
  VideoGenInput,
  VideoJob,
  VideoProvider,
} from "@dasd/higg-shared";
import { nanoid } from "nanoid";
import { PRESETS } from "../../presets/seed";
import { aspectSize, writeMedia } from "../../store/media";

/**
 * The keyless placeholder video provider. Mirrors the image stub, but async:
 * `submit` queues an in-memory job and `poll` walks it through a wall-clock
 * lifecycle (<2s queued, <6s running, then succeeded) so the whole submit→poll
 * UI flow works with no API key. The "video" itself is an animated SVG (SMIL
 * `<animateTransform>`/`<animate>`): a drifting gradient plus a panning subject
 * whose motion loosely matches the chosen preset's motionType.
 */

const QUEUED_UNTIL_MS = 2_000;
const RUNNING_UNTIL_MS = 6_000;

interface StubJob {
  input: VideoGenInput;
  submittedAt: number;
  /** Rendered once on the first poll past RUNNING_UNTIL_MS, then reused. */
  assets?: MediaAsset[];
}

export class StubVideoProvider implements VideoProvider {
  readonly id = "stub-video";
  readonly defaultModel = "placeholder-motion";
  readonly isStub = true;
  readonly supportsImageToVideo = true;
  readonly supportsCameraControl = true;
  private readonly jobs = new Map<string, StubJob>();

  async submit(input: VideoGenInput): Promise<VideoJob> {
    const jobId = nanoid();
    this.jobs.set(jobId, { input, submittedAt: Date.now() });
    return {
      jobId,
      status: "queued",
      provider: this.id,
      model: this.defaultModel,
      providerJobId: jobId,
    };
  }

  async poll(jobId: string): Promise<VideoJob> {
    const base = { jobId, provider: this.id, model: this.defaultModel, providerJobId: jobId };
    const job = this.jobs.get(jobId);
    if (!job) {
      // Jobs live only in memory — a restart (or a bogus id) lands here.
      return { ...base, status: "failed", error: `unknown stub video job: ${jobId}` };
    }
    const elapsed = Date.now() - job.submittedAt;
    if (elapsed < QUEUED_UNTIL_MS) return { ...base, status: "queued" };
    if (elapsed < RUNNING_UNTIL_MS) return { ...base, status: "running" };
    if (!job.assets) {
      const { width, height } = aspectSize(job.input.aspectRatio ?? "16:9");
      const svg = renderAnimatedSvg(job.input);
      const asset = writeMedia({
        bytes: new Uint8Array(Buffer.from(svg, "utf8")),
        mimeType: "image/svg+xml",
        width,
        height,
      });
      job.assets = [{ ...asset, durationSec: job.input.durationSec ?? 5 }];
    }
    return { ...base, status: "succeeded", assets: job.assets };
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

/** The five SMIL motions the stub can fake; every preset maps onto one. */
type MotionKind = "pan-x" | "pan-y" | "scale" | "rotate" | "shake";

function motionKindFor(motionType: MotionTypeValue): MotionKind {
  switch (motionType) {
    case "pan":
    case "fpv":
      return "pan-x";
    case "tilt":
    case "crane":
      return "pan-y";
    case "zoom":
    case "dolly":
      return "scale";
    case "orbit":
    case "bullet_time":
      return "rotate";
    case "handheld":
      return "shake";
  }
}

/** The moving "subject" group, drawn centred at its own origin then animated. */
function subjectElement(
  kind: MotionKind,
  width: number,
  height: number,
  hue: number,
  dur: string,
): string {
  const rw = Math.round(width * 0.28);
  const rh = Math.round(height * 0.28);
  const rect = `<rect x="${-Math.round(rw / 2)}" y="${-Math.round(rh / 2)}" width="${rw}" height="${rh}" rx="${Math.round(Math.min(rw, rh) * 0.12)}" fill="hsl(${hue}, 80%, 60%)" fill-opacity="0.3" stroke="hsl(${hue}, 90%, 72%)" stroke-opacity="0.8" stroke-width="2"/>`;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  switch (kind) {
    case "pan-x": {
      const x0 = Math.round(width * 0.25);
      const x1 = Math.round(width * 0.75);
      return `<g transform="translate(0 ${cy})"><g><animateTransform attributeName="transform" type="translate" values="${x0} 0; ${x1} 0; ${x0} 0" dur="${dur}" repeatCount="indefinite"/>${rect}</g></g>`;
    }
    case "pan-y": {
      const y0 = Math.round(height * 0.28);
      const y1 = Math.round(height * 0.72);
      return `<g transform="translate(${cx} 0)"><g><animateTransform attributeName="transform" type="translate" values="0 ${y1}; 0 ${y0}; 0 ${y1}" dur="${dur}" repeatCount="indefinite"/>${rect}</g></g>`;
    }
    case "scale":
      return `<g transform="translate(${cx} ${cy})"><g><animateTransform attributeName="transform" type="scale" values="0.7;1.3;0.7" dur="${dur}" repeatCount="indefinite"/>${rect}</g></g>`;
    case "rotate":
      return `<g transform="translate(${cx} ${cy})"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}" repeatCount="indefinite"/><g transform="translate(0 ${-Math.round(height * 0.22)})">${rect}</g></g></g>`;
    case "shake":
      return `<g transform="translate(${cx} ${cy})"><g><animateTransform attributeName="transform" type="translate" values="0 0; 8 -6; -7 4; 6 7; -8 -5; 0 0" dur="0.9s" repeatCount="indefinite"/>${rect}</g></g>`;
  }
}

function renderAnimatedSvg(input: VideoGenInput): string {
  const aspectRatio = input.aspectRatio ?? "16:9";
  const { width, height } = aspectSize(aspectRatio);
  const durationSec = input.durationSec ?? 5;
  const dur = `${Math.max(2, durationSec)}s`;
  const preset = input.presetId ? PRESETS.find((p) => p.id === input.presetId) : undefined;
  const motionType: MotionTypeValue = preset?.motionType ?? "pan";
  const kind = motionKindFor(motionType);

  const seed = hashInt(input.prompt.trim() || "placeholder");
  const hue = seed % 360;
  const hue2 = (hue + 60) % 360;
  const cx = Math.round(width / 2);

  const trimmed = input.prompt.trim() || "your prompt here";
  const promptLabel = trimmed.length > 64 ? `${trimmed.slice(0, 63)}…` : trimmed;
  const fontSize = Math.max(20, Math.round(width * 0.032));
  const markFont = Math.max(13, Math.round(width * 0.021));
  const font = "'Segoe UI', system-ui, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="placeholder video">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="hsl(${hue}, 42%, 13%)"/>
      <stop offset="0.5" stop-color="hsl(${(hue + 30) % 360}, 38%, 8%)"/>
      <stop offset="1" stop-color="hsl(${hue2}, 46%, 14%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="75%">
      <stop offset="0" stop-color="hsl(${hue2}, 88%, 62%)" stop-opacity="0.28"/>
      <stop offset="1" stop-color="hsl(${hue2}, 88%, 62%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="hsl(${hue}, 40%, 7%)"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 0; ${-width} 0; 0 0" dur="${Math.max(4, durationSec * 2)}s" repeatCount="indefinite"/>
    <rect width="${width * 2}" height="${height}" fill="url(#bg)"/>
  </g>
  <rect width="${width}" height="${height}" fill="url(#glow)">
    <animate attributeName="opacity" values="0.55;1;0.55" dur="3.6s" repeatCount="indefinite"/>
  </rect>
  ${subjectElement(kind, width, height, hue2, dur)}
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${Math.round(markFont * 1.1)}" y="${Math.round(markFont * 1.9)}" font-family="${font}" font-size="${markFont}" font-weight="700" letter-spacing="2" fill="#ffffff" fill-opacity="0.5">STUB VIDEO · ${escapeXml(aspectRatio)} · ${durationSec}S · ${escapeXml(motionType.toUpperCase())}</text>
  <text x="${cx}" y="${height - Math.round(markFont * 4.2)}" font-family="${font}" font-size="${fontSize}" font-weight="600" fill="#f4f4f5" text-anchor="middle">${escapeXml(promptLabel)}</text>
  <text x="${cx}" y="${height - Math.round(markFont * 1.8)}" font-family="${font}" font-size="${markFont}" letter-spacing="1.5" fill="#f4f4f5" fill-opacity="0.68" text-anchor="middle">PLACEHOLDER · ADD FAL_KEY</text>
</svg>`;
}
