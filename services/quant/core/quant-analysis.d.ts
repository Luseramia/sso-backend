// Generated from x-webapp/src/services/quant-analysis.ts by npm run sync:quant-backend.
// Edit the source and regenerate; do not edit this deployment artifact.
import type { PriceBar, PriceSeries } from "./twelve-data.ts";
export declare const QUANT_ENGINE_VERSION = "1.0.0";
export interface QuantSettings {
    lookback: number;
    trainingPercent: number;
    entryZ: number;
    exitZ: number;
    stopZ: number;
    maxHoldingDays: number;
    feeBps: number;
    slippageBps: number;
    borrowPercent: number;
    capital: number;
    requireCointegration: boolean;
}
export declare const DEFAULT_QUANT_SETTINGS: QuantSettings;
export declare function moments(values: number[]): {
    mean: number;
    sd: number;
};
export declare function fitLine(x: number[], y: number[]): {
    alpha: number;
    beta: number;
};
export declare function correlation(x: number[], y: number[]): number | null;
/** Mean and sample SD use the previous W observations, excluding the current observation. */
export declare function rollingStats(values: number[], window: number): ({
    mean: null;
    sd: null;
    z: null;
} | {
    mean: number;
    sd: number;
    z: number | null;
})[];
/** ADF with exactly one lag: Δy[t] = rho*y[t-1] + gamma*Δy[t-1] (+ constant). */
export declare function adfLagOne(values: number[], intercept: boolean): number | null;
export declare function criticalValue5(n: number, pair: boolean): number;
export interface PairRow {
    date: string;
    a: PriceBar;
    b: PriceBar;
}
export declare function alignSeries(a: PriceSeries, b: PriceSeries): {
    rows: PairRow[];
    droppedA: number;
    droppedB: number;
};
export declare function validateSettings(settings: QuantSettings, count: number): number;
export interface Trade {
    entryDate: string;
    exitDate: string;
    direction: "Long spread" | "Short spread";
    pnl: number;
    costs: number;
    holdingDays: number;
    reason: string;
}
/** Fixed share ratio, gross exposure = equity at entry, next-open fills, daily marking. */
export declare function backtestPair(rows: PairRow[], zScores: (number | null)[], beta: number, start: number, settings: QuantSettings, eligible: boolean): {
    trades: Trade[];
    equity: {
        date: string;
        value: number;
    }[];
    totalCosts: number;
    netReturn: number;
    drawdown: number;
    sharpe: number | null;
    winRate: number | null;
};
export declare function analyzePair(a: PriceSeries, b: PriceSeries, settings: QuantSettings): {
    trainingCount: number;
    alpha: number;
    beta: number;
    spreads: number[];
    rolling: ({
        mean: null;
        sd: null;
        z: null;
    } | {
        mean: number;
        sd: number;
        z: number | null;
    })[];
    halfLife: number | null;
    testStatistic: number | null;
    critical: number;
    passes: boolean;
    integrationA: {
        level: number | null;
        difference: number | null;
        compatible: boolean;
    };
    integrationB: {
        level: number | null;
        difference: number | null;
        compatible: boolean;
    };
    returnCorrelation: number | null;
    a: {
        annualVolatility: number;
        rolling: ({
            mean: null;
            sd: null;
            z: null;
        } | {
            mean: number;
            sd: number;
            z: number | null;
        })[];
        mean: number;
        sd: number;
    };
    b: {
        annualVolatility: number;
        rolling: ({
            mean: null;
            sd: null;
            z: null;
        } | {
            mean: number;
            sd: number;
            z: number | null;
        })[];
        mean: number;
        sd: number;
    };
    backtest: {
        trades: Trade[];
        equity: {
            date: string;
            value: number;
        }[];
        totalCosts: number;
        netReturn: number;
        drawdown: number;
        sharpe: number | null;
        winRate: number | null;
    };
    rows: PairRow[];
    droppedA: number;
    droppedB: number;
};
