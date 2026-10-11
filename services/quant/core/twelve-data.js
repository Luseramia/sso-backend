// Generated from x-webapp/src/services/twelve-data.ts by npm run sync:quant-backend.
// Edit the source and regenerate; do not edit this deployment artifact.
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
    ? value : {};
export function normalizeSymbol(symbol) {
    const normalized = symbol.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized)) {
        throw new Error("กรอก ticker หุ้น/ETF สหรัฐฯ เช่น AAPL, SPY หรือ QQQ");
    }
    return normalized;
}
/** Exclude the current New York session even after its close, conservatively. */
export function latestCompletedDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const part = (type) => parts.find((item) => item.type === type).value;
    const midnight = Date.parse(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
    return new Date(midnight - 86_400_000).toISOString().slice(0, 10);
}
export function parseTimeSeries(payload, requestedSymbol, cutoff) {
    const data = record(payload);
    if (data.status === "error" || !Array.isArray(data.values)) {
        const code = Number(data.code);
        if (code === 401)
            throw new Error("API key ไม่ถูกต้อง กรุณาตรวจสอบ Twelve Data key");
        if (code === 429)
            throw new Error("ใช้โควตา Twelve Data ครบแล้ว กรุณารอแล้วลองใหม่");
        if (code === 403)
            throw new Error("แพ็กเกจ API ยังไม่รองรับข้อมูลนี้ ตรวจสอบสิทธิ์ของ Twelve Data key");
        throw new Error(`ไม่พบราคาของ ${requestedSymbol} ตรวจสอบ ticker, API key และสิทธิ์ข้อมูลของแพ็กเกจ`);
    }
    const meta = record(data.meta);
    if (meta.symbol !== requestedSymbol || meta.currency !== "USD" || meta.exchange_timezone !== "America/New_York") {
        throw new Error(`ข้อมูล ${requestedSymbol} ไม่ตรงกับหุ้น/ETF สหรัฐฯ สกุล USD ที่ร้องขอ`);
    }
    const seen = new Set();
    const bars = [];
    for (const value of data.values) {
        const row = record(value);
        const date = String(row.datetime ?? "");
        const open = Number(row.open);
        const close = Number(row.close);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
            new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
            !Number.isFinite(open) || !Number.isFinite(close) || open <= 0 || close <= 0 || seen.has(date)) {
            throw new Error(`ข้อมูลราคา ${requestedSymbol} มีวันที่ซ้ำหรือค่าที่ไม่ถูกต้อง`);
        }
        seen.add(date);
        if (date <= cutoff)
            bars.push({ date, open, close });
    }
    bars.sort((a, b) => a.date.localeCompare(b.date));
    if (bars.length < 60)
        throw new Error(`${requestedSymbol} มีข้อมูลไม่ถึง 60 วันซื้อขาย ลองเพิ่มจำนวนวันหรือเปลี่ยน ticker`);
    return {
        symbol: requestedSymbol, exchange: String(meta.exchange ?? "US"), currency: "USD",
        bars, fetchedAt: new Date().toISOString(),
    };
}
export async function fetchDailyPrices(symbol, apiKey, count, signal) {
    const ticker = normalizeSymbol(symbol);
    if (!apiKey.trim())
        throw new Error("กรอก Twelve Data API key ก่อนโหลดราคา");
    if (!Number.isInteger(count) || count < 100 || count > 2000)
        throw new Error("จำนวนวันต้องอยู่ระหว่าง 100–2,000");
    const cutoff = latestCompletedDate();
    const params = new URLSearchParams({
        symbol: ticker, country: "United States", interval: "1day", outputsize: String(count),
        order: "asc", adjust: "all", end_date: `${cutoff} 23:59:59`, apikey: apiKey.trim(),
    });
    try {
        const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, {
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
            credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
        });
        if (response.status === 429)
            throw new Error("ใช้โควตา Twelve Data ครบแล้ว กรุณารอแล้วลองใหม่");
        if (!response.ok)
            throw new Error(`Twelve Data ตอบกลับ HTTP ${response.status} กรุณาตรวจสอบ API key และลองใหม่`);
        return parseTimeSeries(await response.json(), ticker, cutoff);
    }
    catch (error) {
        if (signal?.aborted)
            throw new DOMException("Cancelled", "AbortError");
        if (error instanceof TypeError || error instanceof SyntaxError) {
            throw new Error("เชื่อมต่อ Twelve Data ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
        }
        if (error instanceof DOMException && error.name === "TimeoutError")
            throw new Error("Twelve Data ใช้เวลาตอบนานเกินไป กรุณาลองใหม่");
        throw error;
    }
}
