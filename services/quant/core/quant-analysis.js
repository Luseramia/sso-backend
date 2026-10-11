// Generated from x-webapp/src/services/quant-analysis.ts by npm run sync:quant-backend.
// Edit the source and regenerate; do not edit this deployment artifact.
export const QUANT_ENGINE_VERSION = "1.0.0";
export const DEFAULT_QUANT_SETTINGS = {
    lookback: 20, trainingPercent: 60, entryZ: 2, exitZ: 0.5, stopZ: 4,
    maxHoldingDays: 20, feeBps: 5, slippageBps: 5, borrowPercent: 3,
    capital: 10_000, requireCointegration: true,
};
export function moments(values) {
    if (!values.length || values.some((v) => !Number.isFinite(v)))
        throw new Error("ข้อมูลสถิติต้องเป็นตัวเลขที่ถูกต้อง");
    let mean = 0;
    let m2 = 0;
    values.forEach((value, index) => {
        const delta = value - mean;
        mean += delta / (index + 1);
        m2 += delta * (value - mean);
    });
    return { mean, sd: values.length > 1 ? Math.sqrt(Math.max(0, m2 / (values.length - 1))) : 0 };
}
export function fitLine(x, y) {
    if (x.length !== y.length || x.length < 3)
        throw new Error("ข้อมูลสำหรับ regression ไม่เพียงพอ");
    const mx = moments(x).mean;
    const my = moments(y).mean;
    const variance = x.reduce((sum, value) => sum + (value - mx) ** 2, 0);
    if (variance <= Number.EPSILON * x.length * Math.max(1, mx * mx))
        throw new Error("ราคาสินทรัพย์ B คงที่หรือมีความแปรปรวนน้อยเกินไป");
    const beta = x.reduce((sum, value, i) => sum + (value - mx) * (y[i] - my), 0) / variance;
    return { alpha: my - beta * mx, beta };
}
export function correlation(x, y) {
    if (x.length !== y.length || x.length < 3)
        return null;
    const a = moments(x);
    const b = moments(y);
    if (a.sd <= 1e-12 || b.sd <= 1e-12)
        return null;
    return Math.max(-1, Math.min(1, x.reduce((sum, v, i) => sum + (v - a.mean) * (y[i] - b.mean), 0) / ((x.length - 1) * a.sd * b.sd)));
}
const returns = (values) => values.slice(1).map((value, i) => Math.log(value / values[i]));
/** Mean and sample SD use the previous W observations, excluding the current observation. */
export function rollingStats(values, window) {
    if (!Number.isInteger(window) || window < 2)
        throw new Error("lookback ต้องเป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป");
    return values.map((value, i) => {
        if (i < window)
            return { mean: null, sd: null, z: null };
        const { mean, sd } = moments(values.slice(i - window, i));
        const tolerance = 1e-10 * Math.max(1, Math.abs(mean));
        return { mean, sd, z: sd > tolerance ? (value - mean) / sd : null };
    });
}
/** ADF with exactly one lag: Δy[t] = rho*y[t-1] + gamma*Δy[t-1] (+ constant). */
export function adfLagOne(values, intercept) {
    if (values.length < 20)
        return null;
    const scale = moments(values).sd;
    if (scale < 1e-10)
        return null;
    const normalized = values.map((v) => v / scale);
    const x = normalized.slice(1, -1);
    const w = normalized.slice(1, -1).map((v, i) => v - normalized[i]);
    const y = normalized.slice(2).map((v, i) => v - normalized[i + 1]);
    const mx = intercept ? moments(x).mean : 0;
    const mw = intercept ? moments(w).mean : 0;
    const my = intercept ? moments(y).mean : 0;
    let xx = 0, ww = 0, xw = 0, xy = 0, wy = 0;
    x.forEach((v, i) => {
        const a = v - mx, b = w[i] - mw, c = y[i] - my;
        xx += a * a;
        ww += b * b;
        xw += a * b;
        xy += a * c;
        wy += b * c;
    });
    const determinant = xx * ww - xw * xw;
    if (determinant <= 1e-12 * xx * ww || xx <= 0 || ww <= 0)
        return null;
    const rho = (xy * ww - wy * xw) / determinant;
    const gamma = (wy * xx - xy * xw) / determinant;
    const sse = y.reduce((sum, v, i) => sum + (v - my - rho * (x[i] - mx) - gamma * (w[i] - mw)) ** 2, 0);
    const se = Math.sqrt((sse / (y.length - (intercept ? 3 : 2))) * ww / determinant);
    return se > 1e-12 && Number.isFinite(rho / se) ? rho / se : null;
}
// MacKinnon (2010), constant model; N=2 for Engle–Granger, N=1 for ADF.
// https://www.statsmodels.org/stable/generated/statsmodels.tsa.adfvalues.mackinnoncrit.html
export function criticalValue5(n, pair) {
    return pair ? -3.33613 - 6.1101 / n - 6.823 / n ** 2
        : -2.86154 - 2.8903 / n - 4.234 / n ** 2 - 40.04 / n ** 3;
}
function checkIntegration(values) {
    const level = adfLagOne(values, true);
    const differences = values.slice(1).map((v, i) => v - values[i]);
    const difference = adfLagOne(differences, true);
    return { level, difference, compatible: level !== null && difference !== null &&
            level >= criticalValue5(values.length - 2, false) && difference < criticalValue5(values.length - 3, false) };
}
export function alignSeries(a, b) {
    if (a.symbol === b.symbol)
        throw new Error("เลือกสินทรัพย์ A และ B คนละ ticker");
    if (a.currency !== b.currency)
        throw new Error("สินทรัพย์ทั้งสองต้องใช้สกุลเงินเดียวกัน");
    const byDate = new Map(b.bars.map((bar) => [bar.date, bar]));
    const rows = a.bars.flatMap((bar) => {
        const other = byDate.get(bar.date);
        return other ? [{ date: bar.date, a: bar, b: other }] : [];
    }).sort((x, y) => x.date.localeCompare(y.date));
    return { rows, droppedA: a.bars.length - rows.length, droppedB: b.bars.length - rows.length };
}
export function validateSettings(settings, count) {
    const { lookback, trainingPercent, entryZ, exitZ, stopZ, maxHoldingDays, feeBps, slippageBps, borrowPercent, capital } = settings;
    if ([lookback, trainingPercent, entryZ, exitZ, stopZ, maxHoldingDays, feeBps, slippageBps, borrowPercent, capital].some((v) => !Number.isFinite(v)))
        throw new Error("กรอกพารามิเตอร์ให้ครบและเป็นตัวเลข");
    if (!Number.isInteger(lookback) || lookback < 5 || lookback > 252)
        throw new Error("lookback ต้องเป็นจำนวนเต็ม 5–252 วัน");
    if (trainingPercent < 40 || trainingPercent > 80)
        throw new Error("ช่วงสร้างโมเดลต้องอยู่ระหว่าง 40–80%");
    if (exitZ < 0 || entryZ <= exitZ || stopZ <= entryZ || stopZ > 20)
        throw new Error("กำหนด 0 ≤ Exit Z < Entry Z < Stop Z ≤ 20");
    if (!Number.isInteger(maxHoldingDays) || maxHoldingDays < 1 || maxHoldingDays > 252)
        throw new Error("วันถือสูงสุดต้องเป็นจำนวนเต็ม 1–252");
    if (feeBps < 0 || slippageBps < 0 || feeBps > 100 || slippageBps > 100 || borrowPercent < 0 || borrowPercent > 100)
        throw new Error("ค่าธรรมเนียม/slippage ต้องเป็น 0–100 bps และค่ายืม 0–100% ต่อปี");
    if (capital < 100 || capital > 1e9)
        throw new Error("เงินเริ่มต้นต้องอยู่ระหว่าง $100–$1,000,000,000");
    const trainingCount = Math.floor(count * trainingPercent / 100);
    if (trainingCount < Math.max(60, lookback + 5) || count - trainingCount < 30)
        throw new Error("ข้อมูลไม่พอ: ต้องมีช่วงสร้างโมเดลอย่างน้อย 60 วันและมากกว่า lookback 5 วัน พร้อมช่วงทดสอบอย่างน้อย 30 วัน");
    return trainingCount;
}
/** Fixed share ratio, gross exposure = equity at entry, next-open fills, daily marking. */
export function backtestPair(rows, zScores, beta, start, settings, eligible) {
    const trades = [];
    const equity = [];
    let cash = settings.capital;
    let totalCosts = 0;
    let position = null;
    const costRate = (settings.feeBps + settings.slippageBps) / 10_000;
    const grossValue = (a, b) => position ? Math.abs(position.unitsA) * a + Math.abs(position.unitsB) * b : 0;
    const close = (i, a, b, reason) => {
        if (!position)
            return;
        const fee = grossValue(a, b) * costRate;
        cash += position.unitsA * (a - position.entryA) + position.unitsB * (b - position.entryB) - fee;
        totalCosts += fee;
        trades.push({ entryDate: rows[position.entryIndex].date, exitDate: rows[i].date,
            direction: position.direction === 1 ? "Long spread" : "Short spread", pnl: cash - position.entryEquity,
            costs: position.costs + fee, holdingDays: i - position.entryIndex, reason });
        position = null;
    };
    for (let i = start; i < rows.length; i += 1) {
        const row = rows[i];
        const z = zScores[i - 1]; // Only yesterday's close is available at today's open.
        let exited = false;
        if (position) {
            const days = (Date.parse(row.date) - Date.parse(rows[i - 1].date)) / 86_400_000;
            const previous = rows[i - 1];
            const shortValue = position.unitsA < 0 ? -position.unitsA * previous.a.close : -position.unitsB * previous.b.close;
            const borrow = shortValue * settings.borrowPercent / 100 * days / 365;
            cash -= borrow;
            position.costs += borrow;
            totalCosts += borrow;
            const atOpen = cash + position.unitsA * (row.a.open - position.entryA) + position.unitsB * (row.b.open - position.entryB);
            const reason = atOpen <= 0 ? "เงินทุนหมด" : z === null ? "SD ใช้ไม่ได้" :
                Math.abs(z) >= settings.stopZ ? "Stop Z" :
                    (position.direction === 1 ? z >= -settings.exitZ : z <= settings.exitZ) ? "กลับสู่ค่าเฉลี่ย" :
                        i - position.entryIndex >= settings.maxHoldingDays ? "ครบวันถือ" : null;
            if (reason) {
                close(i, row.a.open, row.b.open, reason);
                exited = true;
            }
        }
        // Earliest signal must come from the test period, not the formation period.
        if (!position && !exited && eligible && beta > 0 && cash > 0 && i > start && i < rows.length - 1 &&
            z !== null && Math.abs(z) >= settings.entryZ && Math.abs(z) < settings.stopZ) {
            const direction = z > 0 ? -1 : 1;
            const units = cash / (row.a.open + beta * row.b.open);
            const fee = cash * costRate;
            position = { unitsA: direction * units, unitsB: -direction * beta * units,
                entryA: row.a.open, entryB: row.b.open, entryIndex: i, entryEquity: cash, costs: fee, direction };
            cash -= fee;
            totalCosts += fee;
        }
        const marked = position ? cash + position.unitsA * (row.a.close - position.entryA) + position.unitsB * (row.b.close - position.entryB) : cash;
        if (position && (i === rows.length - 1 || marked <= 0))
            close(i, row.a.close, row.b.close, marked <= 0 ? "เงินทุนหมด" : "สิ้นสุดข้อมูล");
        equity.push({ date: row.date, value: position ? marked : cash });
    }
    let peak = settings.capital;
    let drawdown = 0;
    const dailyReturns = [];
    equity.forEach((point, i) => {
        peak = Math.max(peak, point.value);
        drawdown = Math.max(drawdown, (peak - point.value) / peak);
        const previous = i ? equity[i - 1].value : settings.capital;
        if (previous > 0)
            dailyReturns.push(point.value / previous - 1);
    });
    const stats = moments(dailyReturns.length ? dailyReturns : [0]);
    return { trades, equity, totalCosts, netReturn: cash / settings.capital - 1, drawdown,
        sharpe: stats.sd > 1e-12 ? stats.mean / stats.sd * Math.sqrt(252) : null,
        winRate: trades.length ? trades.filter((trade) => trade.pnl > 0).length / trades.length : null };
}
export function analyzePair(a, b, settings) {
    const aligned = alignSeries(a, b);
    const { rows } = aligned;
    const trainingCount = validateSettings(settings, rows.length);
    const pricesA = rows.map((row) => row.a.close);
    const pricesB = rows.map((row) => row.b.close);
    const trainA = pricesA.slice(0, trainingCount);
    const trainB = pricesB.slice(0, trainingCount);
    const { alpha, beta } = fitLine(trainB, trainA);
    const spreads = pricesA.map((price, i) => price - alpha - beta * pricesB[i]);
    const trainSpread = spreads.slice(0, trainingCount);
    const testStatistic = adfLagOne(trainSpread, false);
    const critical = criticalValue5(trainingCount - 1, true);
    const integrationA = checkIntegration(trainA);
    const integrationB = checkIntegration(trainB);
    const passes = testStatistic !== null && testStatistic < critical && integrationA.compatible && integrationB.compatible;
    let halfLife = null;
    if (moments(trainSpread).sd > 1e-8) {
        try {
            const phi = fitLine(trainSpread.slice(0, -1), trainSpread.slice(1)).beta;
            if (phi > 0 && phi < 1)
                halfLife = Math.log(0.5) / Math.log(phi);
        }
        catch { /* Degenerate residuals have no estimable half-life. */ }
    }
    const rolling = rollingStats(spreads, settings.lookback);
    const single = (values) => ({
        ...moments(values.slice(-settings.lookback)),
        annualVolatility: moments(returns(values.slice(-settings.lookback - 1))).sd * Math.sqrt(252),
        rolling: rollingStats(values, settings.lookback),
    });
    return { ...aligned, trainingCount, alpha, beta, spreads, rolling, halfLife,
        testStatistic, critical, passes, integrationA, integrationB,
        returnCorrelation: correlation(returns(trainA), returns(trainB)),
        a: single(pricesA), b: single(pricesB),
        backtest: backtestPair(rows, rolling.map((point) => point.z), beta, trainingCount, settings, beta > 0 && (!settings.requireCointegration || passes)),
    };
}
