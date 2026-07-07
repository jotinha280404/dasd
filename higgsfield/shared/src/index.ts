/**
 * @dasd/higg-shared — types shared between the higgsfield web app and server.
 *
 * Phase 3 fills this out:
 *   - media.ts      → provider interfaces, MediaRef, JobStatus, AspectRatio
 *   - models.ts     → CameraPreset / Generation / Character schemas
 *   - modelTable.ts → provider + model IDs and per-unit rates (data, not code)
 */
export const HIGG_SHARED_VERSION = "0.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}
