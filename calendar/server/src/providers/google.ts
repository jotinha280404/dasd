import type {
  CalendarEvent,
  CalendarProvider,
  DateRange,
  EventInput,
  EventPatch,
} from "@dasd/cal-shared";

/**
 * A documented drop-in seam for Google Calendar. This is intentionally a stub:
 * the local provider is the default, and the factory in `./index.ts` NEVER
 * selects this adapter unless a full set of OAuth credentials is present.
 *
 * To make it real, install `googleapis`, exchange the refresh token for an
 * access token, and map Google's `events.list/insert/patch/delete` onto the
 * `CalendarProvider` contract:
 *   - `list(range)`   → `calendar.events.list({ timeMin: range.from,
 *                        timeMax: range.to, singleEvents: true })`
 *   - `create(input)` → `calendar.events.insert({ requestBody: toGoogle(input) })`
 *   - `update(id,..)` → `calendar.events.patch({ eventId: id, requestBody })`
 *   - `remove(id)`    → `calendar.events.delete({ eventId: id })`
 * mapping `start.dateTime`/`end.dateTime` ↔ our ISO `start`/`end` and Google's
 * `colorId` ↔ our `EventColor`. Until then every method reports "not configured".
 */

export interface GoogleCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Reads Google OAuth creds from the environment, or null when incomplete. */
export function googleCreds(): GoogleCreds | null {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = "google" as const;

  constructor(private readonly creds: GoogleCreds) {}

  private notConfigured(): never {
    throw new Error(
      "GoogleCalendarProvider is a drop-in seam and is not wired to the Google " +
        "Calendar API yet. Install `googleapis` and implement the mappings " +
        "documented in providers/google.ts.",
    );
  }

  async list(_range: DateRange): Promise<CalendarEvent[]> {
    return this.notConfigured();
  }

  async create(_input: EventInput): Promise<CalendarEvent> {
    return this.notConfigured();
  }

  async update(_id: string, _patch: EventPatch): Promise<CalendarEvent> {
    return this.notConfigured();
  }

  async remove(_id: string): Promise<void> {
    return this.notConfigured();
  }
}
