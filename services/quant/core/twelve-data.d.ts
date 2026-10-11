// Generated from x-webapp/src/services/twelve-data.ts by npm run sync:quant-backend.
// Edit the source and regenerate; do not edit this deployment artifact.
export interface PriceBar {
    date: string;
    open: number;
    close: number;
}
export interface PriceSeries {
    symbol: string;
    exchange: string;
    currency: string;
    bars: PriceBar[];
    fetchedAt: string;
}
export declare function normalizeSymbol(symbol: string): string;
/** Exclude the current New York session even after its close, conservatively. */
export declare function latestCompletedDate(now?: Date): string;
export declare function parseTimeSeries(payload: unknown, requestedSymbol: string, cutoff: string): PriceSeries;
export declare function fetchDailyPrices(symbol: string, apiKey: string, count: number, signal?: AbortSignal): Promise<PriceSeries>;
