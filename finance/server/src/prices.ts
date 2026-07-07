import type { Cents, Holding } from "@dasd/fin-shared";

/**
 * Price provider seam. The app works fully offline with manually-entered prices;
 * a real market-data provider is a drop-in adapter selected by `PRICE_PROVIDER`.
 * No key is required for the default `manual` provider.
 */

export interface PriceProvider {
  readonly name: string;
  /** Returns the latest price-per-unit (cents) keyed by holding id. */
  quote(holdings: Holding[]): Promise<Map<string, Cents>>;
}

/** Default provider: echoes each holding's stored `currentPrice` unchanged. */
const manualProvider: PriceProvider = {
  name: "manual",
  async quote(holdings: Holding[]): Promise<Map<string, Cents>> {
    const out = new Map<string, Cents>();
    for (const h of holdings) out.set(h.id, h.currentPrice);
    return out;
  },
};

/**
 * Resolve the active provider from `PRICE_PROVIDER`. Unknown / unset values fall
 * back to `manual`. Add real adapters (e.g. "stooq") here — they should read
 * their own key from env and never break the manual path.
 */
export function getPriceProvider(): PriceProvider {
  const selected = (process.env["PRICE_PROVIDER"] ?? "manual").toLowerCase();
  switch (selected) {
    // case "stooq": return stooqProvider;
    case "manual":
    case "none":
    case "":
      return manualProvider;
    default:
      return manualProvider;
  }
}
