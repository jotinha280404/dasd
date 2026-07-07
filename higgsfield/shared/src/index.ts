/**
 * @dasd/higg-shared — the contract shared between the higgsfield web app and
 * server: the domain model (presets, generations, characters), the provider
 * adapter interfaces, and the model/rate table.
 */
export const HIGG_SHARED_VERSION = "1.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}

export * from "./models";
export * from "./media";
export * from "./modelTable";
