import type { ImageGenInput, ImageGenResult, ImageProvider, MediaAsset } from "@dasd/higg-shared";
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS } from "@dasd/higg-shared";
import { z } from "zod";
import { aspectSize, dataUrlToBytes, writeMedia } from "../../store/media";
import { clampCount, delay } from "./common";

/**
 * The real image provider. Mirrors the proven pin-factory REST call:
 * POST `<model>:generateContent` with an `x-goog-api-key` header and a
 * `generationConfig.responseModalities: ["IMAGE"]` body, reading the base64 image
 * back from `candidates[0].content.parts[].inlineData.data`. Reference images are
 * passed inline alongside the text prompt. No SDK — raw `fetch`. Retries a couple
 * of times on rate-limit / 5xx / network errors.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const InlineData = z.object({ mimeType: z.string().optional(), data: z.string() });
const Part = z.object({
  text: z.string().optional(),
  inlineData: InlineData.optional(),
  inline_data: InlineData.optional(),
});
const GeminiResponse = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(Part).default([]) }).optional() }))
    .default([]),
});
type GeminiResponse = z.infer<typeof GeminiResponse>;

interface InlineImage {
  mimeType: string;
  data: string;
}

type PromptPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiImageProvider implements ImageProvider {
  readonly id = "gemini";
  readonly defaultModel: string;
  readonly isStub = false;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model ?? process.env["IMAGE_MODEL"] ?? DEFAULT_IMAGE_MODEL;
  }

  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    const aspectRatio = input.aspectRatio ?? "1:1";
    const count = clampCount(input.count);
    const body = {
      contents: [{ parts: this.buildParts(input) }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      },
    };
    const { width, height } = aspectSize(aspectRatio);
    const assets: MediaAsset[] = [];
    for (let i = 0; i < count; i++) {
      const image = await this.requestImage(body);
      assets.push(
        writeMedia({
          bytes: new Uint8Array(Buffer.from(image.data, "base64")),
          mimeType: image.mimeType,
          width,
          height,
        }),
      );
    }
    const estCostUsd = (IMAGE_MODELS as Record<string, { estCostUsd: number } | undefined>)[
      this.defaultModel
    ]?.estCostUsd;
    return {
      assets,
      provider: this.id,
      model: this.defaultModel,
      costUsd: estCostUsd !== undefined ? estCostUsd * count : undefined,
    };
  }

  private buildParts(input: ImageGenInput): PromptPart[] {
    const parts: PromptPart[] = [{ text: input.prompt }];
    for (const ref of input.references ?? []) {
      const decoded = dataUrlToBytes(ref);
      if (!decoded) continue;
      parts.push({
        inlineData: {
          mimeType: decoded.mimeType,
          data: Buffer.from(decoded.bytes).toString("base64"),
        },
      });
    }
    return parts;
  }

  private async requestImage(body: unknown, retries = 3): Promise<InlineImage> {
    const url = `${API_BASE}/${this.defaultModel}:generateContent`;
    let lastError = "";
    for (let attempt = 1; attempt <= retries; attempt++) {
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify(body),
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < retries) {
          await delay(1000 * attempt);
          continue;
        }
        throw new Error(`Gemini request failed: ${lastError}`);
      }
      if ((resp.status === 429 || resp.status >= 500) && attempt < retries) {
        lastError = `HTTP ${resp.status}`;
        await delay(1500 * attempt);
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Gemini ${resp.status}: ${text.slice(0, 300)}`);
      }
      const json: unknown = await resp.json();
      const parsed = GeminiResponse.safeParse(json);
      if (!parsed.success) throw new Error("Gemini: unexpected response shape");
      const image = firstInlineImage(parsed.data);
      if (image) return image;
      throw new Error("Gemini: no image in response");
    }
    throw new Error(`Gemini: exhausted retries (${lastError})`);
  }
}

function firstInlineImage(response: GeminiResponse): InlineImage | null {
  for (const candidate of response.candidates) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline) return { mimeType: inline.mimeType ?? "image/png", data: inline.data };
    }
  }
  return null;
}
