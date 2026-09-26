import { and, asc, desc, eq } from "drizzle-orm";
import {
  financialAccountMappingsTable,
  financialCompaniesTable,
  financialDocumentsTable,
  financialValuesTable,
} from "../../db/financial-analysis.schema";
import dz from "../../drizzle.service";

export type Unit = "ONES" | "THOUSAND" | "MILLION" | "BILLION";

export interface CanonicalAccount {
  code: string;
  name: string;
  category: "ASSET" | "LIABILITY" | "EQUITY";
  subcategory: string;
  isTotal?: boolean;
}

export interface ImportValue {
  periodEnd: string;
  value: number;
  originalValue: string;
}

export interface ImportRow {
  originalLabel: string;
  canonicalCode?: string | null;
  confidence?: number;
  mappingSource?: string;
  sourceRow: number;
  values: ImportValue[];
}

export interface ImportPayload {
  companyId: number;
  fileName: string;
  fileType: string;
  currency: string;
  unit: Unit;
  rows: ImportRow[];
}

const ACCOUNTS: CanonicalAccount[] = [
  { code: "ASSET.CURRENT", name: "Total Current Assets", category: "ASSET", subcategory: "CURRENT", isTotal: true },
  { code: "ASSET.CASH", name: "Cash and Cash Equivalents", category: "ASSET", subcategory: "CURRENT" },
  { code: "ASSET.SHORT_TERM_INVESTMENT", name: "Short-term Investments", category: "ASSET", subcategory: "CURRENT" },
  { code: "ASSET.RECEIVABLE", name: "Trade and Other Receivables", category: "ASSET", subcategory: "CURRENT" },
  { code: "ASSET.INVENTORY", name: "Inventories", category: "ASSET", subcategory: "CURRENT" },
  { code: "ASSET.OTHER_CURRENT", name: "Other Current Assets", category: "ASSET", subcategory: "CURRENT" },
  { code: "ASSET.NON_CURRENT", name: "Total Non-current Assets", category: "ASSET", subcategory: "NON_CURRENT", isTotal: true },
  { code: "ASSET.PPE", name: "Property, Plant and Equipment", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.RIGHT_OF_USE", name: "Right-of-use Assets", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.INVESTMENT", name: "Long-term Investments", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.GOODWILL", name: "Goodwill", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.INTANGIBLE", name: "Intangible Assets", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.DEFERRED_TAX", name: "Deferred Tax Assets", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.OTHER_NON_CURRENT", name: "Other Non-current Assets", category: "ASSET", subcategory: "NON_CURRENT" },
  { code: "ASSET.TOTAL", name: "Total Assets", category: "ASSET", subcategory: "TOTAL", isTotal: true },
  { code: "LIABILITY.CURRENT", name: "Total Current Liabilities", category: "LIABILITY", subcategory: "CURRENT", isTotal: true },
  { code: "LIABILITY.AP", name: "Trade and Other Payables", category: "LIABILITY", subcategory: "CURRENT" },
  { code: "LIABILITY.SHORT_TERM_DEBT", name: "Short-term Debt", category: "LIABILITY", subcategory: "CURRENT" },
  { code: "LIABILITY.CURRENT_PORTION_LONG_TERM_DEBT", name: "Current Portion of Long-term Debt", category: "LIABILITY", subcategory: "CURRENT" },
  { code: "LIABILITY.CURRENT_LEASE", name: "Current Lease Liabilities", category: "LIABILITY", subcategory: "CURRENT" },
  { code: "LIABILITY.OTHER_CURRENT", name: "Other Current Liabilities", category: "LIABILITY", subcategory: "CURRENT" },
  { code: "LIABILITY.NON_CURRENT", name: "Total Non-current Liabilities", category: "LIABILITY", subcategory: "NON_CURRENT", isTotal: true },
  { code: "LIABILITY.LONG_TERM_DEBT", name: "Long-term Debt", category: "LIABILITY", subcategory: "NON_CURRENT" },
  { code: "LIABILITY.BOND", name: "Bonds", category: "LIABILITY", subcategory: "NON_CURRENT" },
  { code: "LIABILITY.LEASE", name: "Non-current Lease Liabilities", category: "LIABILITY", subcategory: "NON_CURRENT" },
  { code: "LIABILITY.DEFERRED_TAX", name: "Deferred Tax Liabilities", category: "LIABILITY", subcategory: "NON_CURRENT" },
  { code: "LIABILITY.OTHER_NON_CURRENT", name: "Other Non-current Liabilities", category: "LIABILITY", subcategory: "NON_CURRENT" },
  { code: "LIABILITY.TOTAL", name: "Total Liabilities", category: "LIABILITY", subcategory: "TOTAL", isTotal: true },
  { code: "EQUITY.SHARE_CAPITAL", name: "Share Capital", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.SHARE_PREMIUM", name: "Share Premium", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.RETAINED_EARNINGS", name: "Retained Earnings", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.RESERVES", name: "Reserves", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.ATTRIBUTABLE_TO_PARENT", name: "Equity Attributable to Owners", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.NON_CONTROLLING_INTEREST", name: "Non-controlling Interests", category: "EQUITY", subcategory: "EQUITY" },
  { code: "EQUITY.TOTAL", name: "Total Equity", category: "EQUITY", subcategory: "TOTAL", isTotal: true },
];

const ALIASES: Record<string, string> = {
  "cash and cash equivalents": "ASSET.CASH", "cash equivalents": "ASSET.CASH", "เงินสดและรายการเทียบเท่าเงินสด": "ASSET.CASH",
  "short term investments": "ASSET.SHORT_TERM_INVESTMENT", "เงินลงทุนระยะสั้น": "ASSET.SHORT_TERM_INVESTMENT",
  "trade and other receivables": "ASSET.RECEIVABLE", "trade receivables": "ASSET.RECEIVABLE", "accounts receivable": "ASSET.RECEIVABLE", "ลูกหนี้การค้าและลูกหนี้อื่น": "ASSET.RECEIVABLE", "ลูกหนี้การค้า": "ASSET.RECEIVABLE",
  inventories: "ASSET.INVENTORY", inventory: "ASSET.INVENTORY", "สินค้าคงเหลือ": "ASSET.INVENTORY",
  "total current assets": "ASSET.CURRENT", "สินทรัพย์หมุนเวียนรวม": "ASSET.CURRENT",
  "property plant and equipment": "ASSET.PPE", "property plant & equipment": "ASSET.PPE", "ที่ดิน อาคารและอุปกรณ์": "ASSET.PPE",
  goodwill: "ASSET.GOODWILL", "ค่าความนิยม": "ASSET.GOODWILL", "intangible assets": "ASSET.INTANGIBLE", "สินทรัพย์ไม่มีตัวตน": "ASSET.INTANGIBLE",
  "total non current assets": "ASSET.NON_CURRENT", "สินทรัพย์ไม่หมุนเวียนรวม": "ASSET.NON_CURRENT", "total assets": "ASSET.TOTAL", "รวมสินทรัพย์": "ASSET.TOTAL",
  "trade and other payables": "LIABILITY.AP", "trade payables": "LIABILITY.AP", "เจ้าหนี้การค้าและเจ้าหนี้อื่น": "LIABILITY.AP",
  "short term borrowings": "LIABILITY.SHORT_TERM_DEBT", "short term debt": "LIABILITY.SHORT_TERM_DEBT", "เงินกู้ยืมระยะสั้น": "LIABILITY.SHORT_TERM_DEBT",
  "total current liabilities": "LIABILITY.CURRENT", "หนี้สินหมุนเวียนรวม": "LIABILITY.CURRENT",
  "long term borrowings": "LIABILITY.LONG_TERM_DEBT", "long term debt": "LIABILITY.LONG_TERM_DEBT", "เงินกู้ยืมระยะยาว": "LIABILITY.LONG_TERM_DEBT",
  "total non current liabilities": "LIABILITY.NON_CURRENT", "หนี้สินไม่หมุนเวียนรวม": "LIABILITY.NON_CURRENT", "total liabilities": "LIABILITY.TOTAL", "รวมหนี้สิน": "LIABILITY.TOTAL",
  "share capital": "EQUITY.SHARE_CAPITAL", "ทุนจดทะเบียน": "EQUITY.SHARE_CAPITAL", "retained earnings": "EQUITY.RETAINED_EARNINGS", "กำไรสะสม": "EQUITY.RETAINED_EARNINGS",
  "non controlling interests": "EQUITY.NON_CONTROLLING_INTEREST", "ส่วนได้เสียที่ไม่มีอำนาจควบคุม": "EQUITY.NON_CONTROLLING_INTEREST", "total equity": "EQUITY.TOTAL", "รวมส่วนของผู้ถือหุ้น": "EQUITY.TOTAL",
};

const UNIT_MULTIPLIER: Record<Unit, number> = { ONES: 1, THOUSAND: 1_000, MILLION: 1_000_000, BILLION: 1_000_000_000 };

export function normalizeLabel(label: string) {
  return label.normalize("NFKC").toLowerCase().replace(/&/g, " and ").replace(/[()\[\]{}.,:;_/\\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function keywordMapping(label: string): string | null {
  const tests: Array<[RegExp, string]> = [
    [/สินทรัพย์.*รวม|total assets/, "ASSET.TOTAL"], [/หนี้สิน.*รวม|total liabilities/, "LIABILITY.TOTAL"], [/ส่วนของผู้ถือหุ้น.*รวม|total equity|shareholders equity/, "EQUITY.TOTAL"],
    [/เงินสด|cash/, "ASSET.CASH"], [/ลูกหนี้|receivable/, "ASSET.RECEIVABLE"], [/สินค้าคงเหลือ|inventor/, "ASSET.INVENTORY"], [/ที่ดิน.*อาคาร.*อุปกรณ์|property.*plant.*equipment|\bppe\b/, "ASSET.PPE"],
    [/ค่าความนิยม|goodwill/, "ASSET.GOODWILL"], [/ไม่มีตัวตน|intangible/, "ASSET.INTANGIBLE"], [/เจ้าหนี้|payable/, "LIABILITY.AP"], [/หุ้นกู้|\bbond/, "LIABILITY.BOND"],
    [/กำไรสะสม|retained earnings/, "EQUITY.RETAINED_EARNINGS"], [/ทุนเรือนหุ้น|ทุนจดทะเบียน|share capital/, "EQUITY.SHARE_CAPITAL"],
  ];
  return tests.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

export function autoMap(label: string) {
  const normalized = normalizeLabel(label);
  const exact = ALIASES[normalized];
  if (exact) return { canonicalCode: exact, confidence: 1, mappingSource: "SYSTEM" };
  const rule = keywordMapping(normalized);
  if (rule) return { canonicalCode: rule, confidence: 0.82, mappingSource: "RULE" };
  return { canonicalCode: null, confidence: 0, mappingSource: "MANUAL" };
}

const safeDivide = (left: number, right: number) => (right === 0 ? null : left / right);
const growth = (current: number, previous: number) => (previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100);
const pick = (values: Record<string, number>, code: string) => values[code] ?? 0;
const sum = (values: Record<string, number>, codes: string[]) => codes.reduce((total, code) => total + pick(values, code), 0);

function totals(values: Record<string, number>) {
  const currentAssets = pick(values, "ASSET.CURRENT") || sum(values, ["ASSET.CASH", "ASSET.SHORT_TERM_INVESTMENT", "ASSET.RECEIVABLE", "ASSET.INVENTORY", "ASSET.OTHER_CURRENT"]);
  const nonCurrentAssets = pick(values, "ASSET.NON_CURRENT") || sum(values, ["ASSET.PPE", "ASSET.RIGHT_OF_USE", "ASSET.INVESTMENT", "ASSET.GOODWILL", "ASSET.INTANGIBLE", "ASSET.DEFERRED_TAX", "ASSET.OTHER_NON_CURRENT"]);
  const totalAssets = pick(values, "ASSET.TOTAL") || currentAssets + nonCurrentAssets;
  const currentLiabilities = pick(values, "LIABILITY.CURRENT") || sum(values, ["LIABILITY.AP", "LIABILITY.SHORT_TERM_DEBT", "LIABILITY.CURRENT_PORTION_LONG_TERM_DEBT", "LIABILITY.CURRENT_LEASE", "LIABILITY.OTHER_CURRENT"]);
  const nonCurrentLiabilities = pick(values, "LIABILITY.NON_CURRENT") || sum(values, ["LIABILITY.LONG_TERM_DEBT", "LIABILITY.BOND", "LIABILITY.LEASE", "LIABILITY.DEFERRED_TAX", "LIABILITY.OTHER_NON_CURRENT"]);
  const totalLiabilities = pick(values, "LIABILITY.TOTAL") || currentLiabilities + nonCurrentLiabilities;
  const totalEquity = pick(values, "EQUITY.TOTAL") || sum(values, ["EQUITY.SHARE_CAPITAL", "EQUITY.SHARE_PREMIUM", "EQUITY.RETAINED_EARNINGS", "EQUITY.RESERVES", "EQUITY.ATTRIBUTABLE_TO_PARENT", "EQUITY.NON_CONTROLLING_INTEREST"]);
  const totalDebt = sum(values, ["LIABILITY.SHORT_TERM_DEBT", "LIABILITY.CURRENT_PORTION_LONG_TERM_DEBT", "LIABILITY.CURRENT_LEASE", "LIABILITY.LONG_TERM_DEBT", "LIABILITY.BOND", "LIABILITY.LEASE"]);
  return { currentAssets, nonCurrentAssets, totalAssets, currentLiabilities, nonCurrentLiabilities, totalLiabilities, totalEquity, totalDebt };
}

export function calculateMetrics(values: Record<string, number>) {
  const total = totals(values);
  const cash = pick(values, "ASSET.CASH");
  const quickAssets = cash + pick(values, "ASSET.SHORT_TERM_INVESTMENT") + pick(values, "ASSET.RECEIVABLE");
  return { ...total, cash, netDebt: total.totalDebt - cash, currentRatio: safeDivide(total.currentAssets, total.currentLiabilities), quickRatio: safeDivide(quickAssets, total.currentLiabilities), debtToEquity: safeDivide(total.totalDebt, total.totalEquity), debtToAssets: safeDivide(total.totalDebt, total.totalAssets), netDebtToEquity: safeDivide(total.totalDebt - cash, total.totalEquity), cashToAssets: safeDivide(cash, total.totalAssets), receivablesToAssets: safeDivide(pick(values, "ASSET.RECEIVABLE"), total.totalAssets), inventoryToAssets: safeDivide(pick(values, "ASSET.INVENTORY"), total.totalAssets), ppeToAssets: safeDivide(pick(values, "ASSET.PPE"), total.totalAssets), goodwillToAssets: safeDivide(pick(values, "ASSET.GOODWILL"), total.totalAssets), equityToAssets: safeDivide(total.totalEquity, total.totalAssets) };
}

export function validate(values: Record<string, number>) {
  const total = totals(values);
  const difference = total.totalAssets - (total.totalLiabilities + total.totalEquity);
  const differencePercent = total.totalAssets === 0 ? 100 : Math.abs(difference) / Math.abs(total.totalAssets) * 100;
  const status = differencePercent <= 0.5 ? "PASS" : differencePercent <= 2 ? "WARNING" : "FAIL";
  return { status, difference, differencePercent, ...total };
}

function trendType(percent: number | null) {
  if (percent === null) return "STABLE";
  if (percent >= 20) return "STRONGLY_INCREASING";
  if (percent >= 3) return "INCREASING";
  if (percent <= -20) return "STRONGLY_DECREASING";
  if (percent <= -3) return "DECREASING";
  return "STABLE";
}

export function buildAnalysis(periods: Array<{ periodEnd: string; fiscalYear: number; values: Record<string, number>; sources: Record<string, unknown> }>) {
  const enriched = periods.map((period) => ({ ...period, metrics: calculateMetrics(period.values), validation: validate(period.values) }));
  const current = enriched.at(-1);
  const previous = enriched.at(-2);
  if (!current) return { periods: enriched, directions: [], signals: [], summary: "ยังไม่มีข้อมูลงบดุล" };
  const metricGrowth = (key: keyof typeof current.metrics) => previous ? growth(Number(current.metrics[key] ?? 0), Number(previous.metrics[key] ?? 0)) : null;
  const assetGrowth = metricGrowth("totalAssets");
  const debtGrowth = metricGrowth("totalDebt");
  const cashGrowth = metricGrowth("cash");
  const equityGrowth = metricGrowth("totalEquity");
  const directions = [
    { dimension: "Asset Base", trend: trendType(assetGrowth), value: assetGrowth, evidence: `สินทรัพย์รวม ${assetGrowth === null ? "ยังไม่มีงวดเปรียบเทียบ" : `${assetGrowth.toFixed(1)}% YoY`}` },
    { dimension: "Liquidity", trend: previous ? trendType(growth(Number(current.metrics.currentRatio ?? 0), Number(previous.metrics.currentRatio ?? 0))) : "STABLE", value: current.metrics.currentRatio, evidence: `Current ratio ${current.metrics.currentRatio?.toFixed(2) ?? "—"}x` },
    { dimension: "Leverage", trend: previous ? trendType(growth(Number(current.metrics.debtToEquity ?? 0), Number(previous.metrics.debtToEquity ?? 0))) : "STABLE", value: current.metrics.debtToEquity, evidence: `D/E ${current.metrics.debtToEquity?.toFixed(2) ?? "—"}x` },
    { dimension: "Equity", trend: trendType(equityGrowth), value: equityGrowth, evidence: `ส่วนของผู้ถือหุ้น ${equityGrowth === null ? "ยังไม่มีงวดเปรียบเทียบ" : `${equityGrowth.toFixed(1)}% YoY`}` },
  ];
  const signals: Array<{ id: string; category: string; severity: "info" | "warning" | "danger"; title: string; message: string; evidence: string[] }> = [];
  if (previous && debtGrowth !== null && debtGrowth > 20 && Number(current.metrics.debtToEquity ?? 0) > Number(previous.metrics.debtToEquity ?? 0)) signals.push({ id: "INCREASING_LEVERAGE", category: "leverage", severity: "warning", title: "ภาระหนี้เพิ่มขึ้น", message: "หนี้เติบโตเร็วและ Debt-to-Equity สูงขึ้น", evidence: [`หนี้ ${debtGrowth.toFixed(1)}% YoY`, `D/E ${previous.metrics.debtToEquity?.toFixed(2) ?? "—"}x → ${current.metrics.debtToEquity?.toFixed(2) ?? "—"}x`] });
  const shortDebtGrowth = previous ? growth(pick(current.values, "LIABILITY.SHORT_TERM_DEBT"), pick(previous.values, "LIABILITY.SHORT_TERM_DEBT")) : null;
  if (previous && cashGrowth !== null && cashGrowth < 0 && shortDebtGrowth !== null && shortDebtGrowth > 0) signals.push({ id: "LIQUIDITY_PRESSURE", category: "liquidity", severity: "danger", title: "แรงกดดันด้านสภาพคล่อง", message: "เงินสดลดลงในขณะที่หนี้ระยะสั้นเพิ่มขึ้น", evidence: [`เงินสด ${cashGrowth.toFixed(1)}% YoY`, `หนี้ระยะสั้น +${shortDebtGrowth.toFixed(1)}% YoY`] });
  const goodwillEquity = safeDivide(pick(current.values, "ASSET.GOODWILL"), current.metrics.totalEquity);
  if (goodwillEquity !== null && goodwillEquity > 0.3) signals.push({ id: "GOODWILL_EXPOSURE", category: "asset_quality", severity: "warning", title: "Goodwill อยู่ในระดับสูง", message: "ควรติดตามความเสี่ยงจากการด้อยค่าของ Goodwill", evidence: [`Goodwill / Equity ${(goodwillEquity * 100).toFixed(1)}%`] });
  if (!signals.length) signals.push({ id: "NO_MATERIAL_WARNING", category: "overview", severity: "info", title: "ไม่พบสัญญาณเตือนตามกฎหลัก", message: "ควรติดตามแนวโน้มต่อเนื่องเมื่อมีข้อมูลงวดใหม่", evidence: [`ตรวจสอบจาก ${enriched.length} งวด`] });
  const summary = [`สินทรัพย์รวมล่าสุด ${assetGrowth === null ? "ยังไม่มีงวดเปรียบเทียบ" : `${assetGrowth >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(assetGrowth).toFixed(1)}%`}`, `หนี้รวม ${debtGrowth === null ? "ยังไม่มีงวดเปรียบเทียบ" : `${debtGrowth >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(debtGrowth).toFixed(1)}%`}`, `Current ratio อยู่ที่ ${current.metrics.currentRatio?.toFixed(2) ?? "—"} เท่า และ D/E อยู่ที่ ${current.metrics.debtToEquity?.toFixed(2) ?? "—"} เท่า`, `พบสัญญาณที่ควรติดตาม ${signals.filter((item) => item.severity !== "info").length} รายการ`].join(" ");
  return { periods: enriched, directions, signals, growth: { assets: assetGrowth, debt: debtGrowth, cash: cashGrowth, equity: equityGrowth }, summary };
}

export default class FinancialAnalysisService {
  accounts() { return ACCOUNTS; }

  async listCompanies(userId: number) {
    return dz.select().from(financialCompaniesTable).where(eq(financialCompaniesTable.create_by_user_id, userId)).orderBy(asc(financialCompaniesTable.name));
  }

  async createCompany(userId: number, input: { name: string; ticker?: string; market?: string; industry?: string; sector?: string; country?: string; defaultCurrency?: string }) {
    const [company] = await dz.insert(financialCompaniesTable).values({ name: input.name.trim(), ticker: input.ticker?.trim().toUpperCase() || null, market: input.market?.trim() || null, industry: input.industry?.trim() || null, sector: input.sector?.trim() || null, country: input.country?.trim().toUpperCase() || "TH", default_currency: input.defaultCurrency?.trim().toUpperCase() || "THB", create_by_user_id: userId }).returning();
    return company;
  }

  private async assertCompany(userId: number, companyId: number) {
    const [company] = await dz.select().from(financialCompaniesTable).where(and(eq(financialCompaniesTable.id, companyId), eq(financialCompaniesTable.create_by_user_id, userId))).limit(1);
    if (!company) throw new Error("company not found");
    return company;
  }

  async preview(userId: number, companyId: number, rows: ImportRow[], unit: Unit) {
    await this.assertCompany(userId, companyId);
    const [savedMappings, existingValues] = await Promise.all([
      dz.select().from(financialAccountMappingsTable).where(eq(financialAccountMappingsTable.create_by_user_id, userId)).orderBy(desc(financialAccountMappingsTable.id)),
      dz.select({ canonicalCode: financialValuesTable.canonical_code, periodEnd: financialValuesTable.period_end })
        .from(financialValuesTable)
        .where(and(eq(financialValuesTable.create_by_user_id, userId), eq(financialValuesTable.company_id, companyId))),
    ]);
    const approved = new Map(savedMappings.filter((item) => item.approved === 1 && (!item.company_id || item.company_id === companyId)).map((item) => [item.normalized_label, item.canonical_code]));
    const mappedRows = rows.map((row) => {
      const normalized = normalizeLabel(row.originalLabel);
      const learned = approved.get(normalized);
      const manual = row.canonicalCode && ACCOUNTS.some((account) => account.code === row.canonicalCode)
        ? { canonicalCode: row.canonicalCode, confidence: 1, mappingSource: "MANUAL" }
        : null;
      const mapping = manual ?? (learned
        ? { canonicalCode: learned, confidence: 0.95, mappingSource: "MANUAL" }
        : autoMap(row.originalLabel));
      return { ...row, ...mapping, normalizedLabel: normalized };
    });
    const periods = Array.from(new Set(rows.flatMap((row) => row.values.map((value) => value.periodEnd)))).sort();
    const validation = periods.map((periodEnd) => { const values: Record<string, number> = {}; for (const row of mappedRows) { if (!row.canonicalCode) continue; const value = row.values.find((item) => item.periodEnd === periodEnd); if (value) values[row.canonicalCode] = (values[row.canonicalCode] ?? 0) + value.value * UNIT_MULTIPLIER[unit]; } return { periodEnd, ...validate(values) }; });
    const duplicatesInFile = periods.flatMap((periodEnd) => { const seen = new Set<string>(); const duplicate = new Set<string>(); mappedRows.forEach((row) => { if (!row.canonicalCode || !row.values.some((value) => value.periodEnd === periodEnd)) return; if (seen.has(row.canonicalCode)) duplicate.add(row.canonicalCode); seen.add(row.canonicalCode); }); return Array.from(duplicate).map((canonicalCode) => ({ periodEnd, canonicalCode })); });
    const existingKeys = new Set(existingValues.map((value) => `${String(value.periodEnd)}:${value.canonicalCode}`));
    const existingDuplicates = mappedRows.flatMap((row) => row.canonicalCode
      ? row.values.filter((value) => existingKeys.has(`${value.periodEnd}:${row.canonicalCode}`)).map((value) => ({ periodEnd: value.periodEnd, canonicalCode: row.canonicalCode! }))
      : []);
    const duplicates = Array.from(new Map([...duplicatesInFile, ...existingDuplicates].map((item) => [`${item.periodEnd}:${item.canonicalCode}`, item])).values());
    return { rows: mappedRows, validation, duplicates, requiresMapping: mappedRows.filter((row) => !row.canonicalCode || row.confidence < 0.7).length };
  }

  async import(userId: number, payload: ImportPayload) {
    await this.assertCompany(userId, payload.companyId);
    const rows = payload.rows.filter((row) => row.canonicalCode && ACCOUNTS.some((account) => account.code === row.canonicalCode));
    if (rows.length !== payload.rows.length) throw new Error("all rows must be mapped before import");
    const periods = Array.from(new Set(rows.flatMap((row) => row.values.map((value) => value.periodEnd)))).sort();
    const existingValues = await dz.select({ canonicalCode: financialValuesTable.canonical_code, periodEnd: financialValuesTable.period_end })
      .from(financialValuesTable)
      .where(and(eq(financialValuesTable.create_by_user_id, userId), eq(financialValuesTable.company_id, payload.companyId)));
    const incomingKeys = new Set(rows.flatMap((row) => row.canonicalCode ? row.values.map((value) => `${value.periodEnd}:${row.canonicalCode}`) : []));
    const duplicate = existingValues.find((value) => incomingKeys.has(`${String(value.periodEnd)}:${value.canonicalCode}`));
    if (duplicate) throw new Error(`duplicate financial value: ${duplicate.canonicalCode} (${String(duplicate.periodEnd)})`);
    const validation = periods.map((periodEnd) => { const values: Record<string, number> = {}; rows.forEach((row) => { const value = row.values.find((item) => item.periodEnd === periodEnd); if (value && row.canonicalCode) values[row.canonicalCode] = (values[row.canonicalCode] ?? 0) + value.value * UNIT_MULTIPLIER[payload.unit]; }); return { periodEnd, ...validate(values) }; });
    const documentIds = await dz.transaction(async (tx) => {
      const ids: number[] = [];
      for (const periodEnd of periods) {
        const fiscalYear = Number(periodEnd.slice(0, 4));
        const check = validation.find((item) => item.periodEnd === periodEnd)!;
        const [document] = await tx.insert(financialDocumentsTable).values({ company_id: payload.companyId, file_name: payload.fileName, file_type: payload.fileType, period_end: periodEnd, fiscal_year: fiscalYear, currency: payload.currency, unit: payload.unit, status: check.status === "FAIL" ? "VALIDATION_FAILED" : "READY", validation_status: check.status, validation_difference: String(check.difference), create_by_user_id: userId }).returning();
        if (!document) throw new Error("unable to create financial document");
        ids.push(document.id);
        const valueRows = rows.flatMap((row) => { const value = row.values.find((item) => item.periodEnd === periodEnd); if (!value || !row.canonicalCode) return []; return [{ company_id: payload.companyId, document_id: document.id, canonical_code: row.canonicalCode, period_end: periodEnd, fiscal_year: fiscalYear, value: String(value.value * UNIT_MULTIPLIER[payload.unit]), currency: payload.currency, unit: payload.unit, original_label: row.originalLabel, original_value: value.originalValue, mapping_confidence: String(row.confidence ?? 1), mapping_source: row.mappingSource ?? "MANUAL", source_row: row.sourceRow, create_by_user_id: userId }]; });
        if (valueRows.length) await tx.insert(financialValuesTable).values(valueRows);
      }
      const manualMappings = rows.filter((row) => row.mappingSource === "MANUAL").map((row) => ({ company_id: payload.companyId, original_label: row.originalLabel, normalized_label: normalizeLabel(row.originalLabel), canonical_code: row.canonicalCode!, confidence: String(1), mapping_source: "MANUAL", approved: 1, create_by_user_id: userId }));
      if (manualMappings.length) await tx.insert(financialAccountMappingsTable).values(manualMappings);
      return ids;
    });
    return { documentIds, validation };
  }

  async dashboard(userId: number, companyId: number) {
    const company = await this.assertCompany(userId, companyId);
    const [storedValues, documents] = await Promise.all([
      dz.select().from(financialValuesTable).where(and(eq(financialValuesTable.company_id, companyId), eq(financialValuesTable.create_by_user_id, userId))).orderBy(asc(financialValuesTable.period_end), asc(financialValuesTable.id)),
      dz.select().from(financialDocumentsTable).where(and(eq(financialDocumentsTable.company_id, companyId), eq(financialDocumentsTable.create_by_user_id, userId))).orderBy(desc(financialDocumentsTable.period_end), desc(financialDocumentsTable.id)),
    ]);
    const byPeriod = new Map<string, { periodEnd: string; fiscalYear: number; values: Record<string, number>; sources: Record<string, unknown> }>();
    storedValues.forEach((row) => { const periodEnd = String(row.period_end); const period = byPeriod.get(periodEnd) ?? { periodEnd, fiscalYear: row.fiscal_year, values: {}, sources: {} }; period.values[row.canonical_code] = Number(row.value); period.sources[row.canonical_code] = { documentId: row.document_id, originalLabel: row.original_label, originalValue: row.original_value, sourceRow: row.source_row, confidence: Number(row.mapping_confidence) }; byPeriod.set(periodEnd, period); });
    return { company, accounts: ACCOUNTS, documents, ...buildAnalysis(Array.from(byPeriod.values())) };
  }
}
