import type { CalendarProvider } from "@dasd/cal-shared";
import { GoogleCalendarProvider, googleCreds } from "./google";
import { LocalCalendarProvider } from "./local";

/**
 * Chooses the calendar backend. Google is selected only when
 * `CALENDAR_PROVIDER === "google"` AND a full set of OAuth creds is present;
 * otherwise the keyless local store is used. Memoized so all callers share one
 * instance (state itself lives in the JSON store singleton).
 */
let cached: CalendarProvider | null = null;

export function getProvider(): CalendarProvider {
  if (cached) return cached;
  const creds = googleCreds();
  if (process.env["CALENDAR_PROVIDER"] === "google" && creds) {
    cached = new GoogleCalendarProvider(creds);
  } else {
    cached = new LocalCalendarProvider();
  }
  return cached;
}
