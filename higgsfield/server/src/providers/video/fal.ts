import type { MediaAsset, VideoGenInput, VideoJob, VideoProvider } from "@dasd/higg-shared";
import { z } from "zod";
import { writeMedia } from "../../store/media";

/**
 * The real video provider: fal.ai's queue API over raw `fetch` (no SDK), with
 * `Authorization: Key <FAL_KEY>`. Every fal-specific assumption lives in this
 * file, marked `ASSUMPTION (fal)`:
 *
 *  1. Submit is `POST https://queue.fal.run/<model-path>` with the
 *     model-specific JSON payload; Kling image-to-video takes
 *     `{ prompt, image_url, duration, aspect_ratio }` where `duration` is a
 *     string ("5"/"10") and `image_url` may be a data: URI (fal accepts them).
 *  2. The submit response is `{ request_id, status_url?, response_url? }`.
 *  3. Status is `GET .../requests/<id>/status` returning
 *     `{ status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" }`; anything else is
 *     treated as failure.
 *  4. Status/result endpoints live under the model's *base* path (the first two
 *     segments, e.g. `fal-ai/kling-video`) — subpaths like
 *     `/v2.1/standard/image-to-video` are dropped. When we still hold the
 *     submit response in memory its `status_url`/`response_url` win.
 *  5. The completed result (`GET .../requests/<id>`) carries the clip at
 *     `video.url` (Kling); we also accept `output.video.url` and a top-level
 *     `url`. The file is a public CDN mp4 we can download without auth.
 */

const QUEUE_BASE = "https://queue.fal.run";
const DEFAULT_FAL_VIDEO_MODEL = "fal-ai/kling-video/v2.1/standard/image-to-video";

const SubmitResponse = z.object({
  request_id: z.string().min(1),
  status_url: z.string().optional(),
  response_url: z.string().optional(),
});

const StatusResponse = z.object({ status: z.string() });

/** ASSUMPTION (fal): `fal-ai/kling-video/v2.1/...` queues under `fal-ai/kling-video`. */
function queueBasePath(model: string): string {
  const segments = model.split("/").filter(Boolean);
  return segments.slice(0, 2).join("/") || model;
}

function pickUrl(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const url = (value as Record<string, unknown>)["url"];
  return typeof url === "string" && url.length > 0 ? url : null;
}

/** Defensive result walk: `video.url`, then `output.video.url` / `output.url`, then `url`. */
function extractVideoUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  const fromVideo = pickUrl(obj["video"]);
  if (fromVideo) return fromVideo;
  const output = obj["output"];
  if (typeof output === "object" && output !== null) {
    const out = output as Record<string, unknown>;
    const fromOutputVideo = pickUrl(out["video"]);
    if (fromOutputVideo) return fromOutputVideo;
    const outputUrl = out["url"];
    if (typeof outputUrl === "string" && outputUrl.length > 0) return outputUrl;
  }
  const topUrl = obj["url"];
  return typeof topUrl === "string" && topUrl.length > 0 ? topUrl : null;
}

interface TrackedJob {
  input: VideoGenInput;
  statusUrl?: string;
  responseUrl?: string;
  /** Downloaded once on the first COMPLETED poll, then reused. */
  assets?: MediaAsset[];
}

export class FalVideoProvider implements VideoProvider {
  readonly id = "fal";
  readonly defaultModel: string;
  readonly isStub = false;
  readonly supportsImageToVideo = true;
  /** Camera control is prompt-driven: presets compose in via `promptSuffix`. */
  readonly supportsCameraControl = true;
  private readonly apiKey: string;
  /** Submit-time context (input + queue URLs); `poll` degrades gracefully without it. */
  private readonly jobs = new Map<string, TrackedJob>();

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.defaultModel =
      model ?? (process.env["FAL_VIDEO_MODEL"]?.trim() || DEFAULT_FAL_VIDEO_MODEL);
  }

  async submit(input: VideoGenInput): Promise<VideoJob> {
    // ASSUMPTION (fal): Kling's payload; `duration` is a *string* of seconds.
    const body: Record<string, string> = {
      prompt: input.prompt,
      duration: String(input.durationSec ?? 5),
    };
    // Data URLs pass straight through — fal accepts data: URIs for image_url.
    if (input.initImageUrl) body["image_url"] = input.initImageUrl;
    if (input.aspectRatio) body["aspect_ratio"] = input.aspectRatio;

    const resp = await fetch(`${QUEUE_BASE}/${this.defaultModel}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Key ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`fal submit ${resp.status}: ${text.slice(0, 300)}`);
    }
    const parsed = SubmitResponse.safeParse(await resp.json().catch(() => null));
    if (!parsed.success) throw new Error("fal submit: unexpected response shape (no request_id)");

    const requestId = parsed.data.request_id;
    this.jobs.set(requestId, {
      input,
      statusUrl: parsed.data.status_url,
      responseUrl: parsed.data.response_url,
    });
    return {
      jobId: requestId,
      status: "queued",
      provider: this.id,
      model: this.defaultModel,
      providerJobId: requestId,
    };
  }

  async poll(jobId: string): Promise<VideoJob> {
    const base = { jobId, provider: this.id, model: this.defaultModel, providerJobId: jobId };
    const failed = (error: string): VideoJob => ({ ...base, status: "failed", error });
    const tracked = this.jobs.get(jobId);
    if (tracked?.assets) return { ...base, status: "succeeded", assets: tracked.assets };

    const queuePath = `${QUEUE_BASE}/${queueBasePath(this.defaultModel)}/requests/${jobId}`;
    const statusUrl = tracked?.statusUrl ?? `${queuePath}/status`;

    let statusResp: Response;
    try {
      statusResp = await fetch(statusUrl, { headers: { authorization: `Key ${this.apiKey}` } });
    } catch (err) {
      return failed(
        `fal status request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!statusResp.ok) {
      const text = await statusResp.text().catch(() => "");
      return failed(`fal status ${statusResp.status}: ${text.slice(0, 300)}`);
    }
    const status = StatusResponse.safeParse(await statusResp.json().catch(() => null));
    if (!status.success) return failed("fal status: unexpected response shape");

    // ASSUMPTION (fal): the only in-flight statuses are IN_QUEUE / IN_PROGRESS;
    // COMPLETED means the result document is ready to fetch.
    if (status.data.status === "IN_QUEUE") return { ...base, status: "queued" };
    if (status.data.status === "IN_PROGRESS") return { ...base, status: "running" };
    if (status.data.status !== "COMPLETED") {
      return failed(`fal job ended with status ${status.data.status}`);
    }

    const responseUrl = tracked?.responseUrl ?? queuePath;
    let resultResp: Response;
    try {
      resultResp = await fetch(responseUrl, { headers: { authorization: `Key ${this.apiKey}` } });
    } catch (err) {
      return failed(
        `fal result request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!resultResp.ok) {
      const text = await resultResp.text().catch(() => "");
      return failed(`fal result ${resultResp.status}: ${text.slice(0, 300)}`);
    }
    const videoUrl = extractVideoUrl(await resultResp.json().catch(() => null));
    if (!videoUrl) return failed("fal result: no video url in payload");

    // ASSUMPTION (fal): output files live on the public fal CDN — no auth header
    // (also avoids leaking the key to a non-queue host).
    let videoResp: Response;
    try {
      videoResp = await fetch(videoUrl);
    } catch (err) {
      return failed(
        `fal video download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!videoResp.ok) return failed(`fal video download ${videoResp.status}`);
    const bytes = new Uint8Array(await videoResp.arrayBuffer());
    if (bytes.length === 0) return failed("fal video download: empty body");

    // ASSUMPTION (fal): Kling clips are mp4.
    const asset = writeMedia({ bytes, mimeType: "video/mp4" });
    const durationSec = tracked ? (tracked.input.durationSec ?? 5) : undefined;
    const assets: MediaAsset[] = [durationSec !== undefined ? { ...asset, durationSec } : asset];
    if (tracked) tracked.assets = assets;
    return { ...base, status: "succeeded", assets };
  }
}
