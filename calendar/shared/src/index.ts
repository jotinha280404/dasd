/**
 * @dasd/cal-shared — the contract shared between the calendar web app and server:
 * the event domain + provider adapter, and the chat/tool-action contract for the
 * natural-language Claude assistant.
 */
export const CAL_SHARED_VERSION = "1.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}

export * from "./events";
export * from "./chat";
