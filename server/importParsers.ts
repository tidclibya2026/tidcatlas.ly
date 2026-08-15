import crypto from "node:crypto";
import * as XLSX from "xlsx";

export type ImportRow = {
  rowNumber: number;
  layerId: string;
  name: string;
  nameEn?: string;
  description?: string;
  latitude: number;
  longitude: number;
  municipality?: string;
  category?: string;
  source?: string;
  sourceKind: "kml" | "excel";
  sourceRecordId?: string;
  metadata: Record<string, string>;
  fingerprint: string;
};

export type ImportIssue = { rowNumber: number; message: string };
export type ImportParseResult = { rows: ImportRow[]; issues: ImportIssue[]; totalRows: number };

function decodeEntities(value: string) {
  return value.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");
}
function stripMarkup(value?: string) {
  return decodeEntities(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function firstTag(value: string, tag: string) {
  const match = value.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}
function htmlText(value: string) { return stripMarkup(value).slice(0, 10000); }
function numberValue(value: unknown) { const number = Number(String(value ?? "").replace(",", ".").trim()); return Number.isFinite(number) ? number : NaN; }
function makeFingerprint(name: string, latitude: number, longitude: number) { return crypto.createHash("sha1").update(`${name.trim().toLowerCase()}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`).digest("hex"); }

function normalizedRow(input: Omit<ImportRow, "fingerprint">): ImportRow { return { ...input, fingerprint: makeFingerprint(input.name, input.latitude, input.longitude) }; }

export function parseKml(buffer: Buffer, defaults?: { layerId?: string; source?: string }): ImportParseResult {
  const xml = buffer.toString("utf8");
  const placemarks = Array.from(xml.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi));
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  placemarks.forEach((match, index) => {
    const block = match[1] || "";
    const name = htmlText(firstTag(block, "name"));
    const description = htmlText(firstTag(block, "description"));
    const coordinates = firstTag(block, "coordinates").split(",").map((part) => Number(part.trim()));
    const longitude = coordinates[0]; const latitude = coordinates[1];
    const metadata: Record<string, string> = {};
    for (const data of Array.from(block.matchAll(/<Data\s+name=["']([^"']+)["'][^>]*>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/Data>/gi)) as RegExpMatchArray[]) metadata[data[1] as string] = htmlText(data[2] as string);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      issues.push({ rowNumber: index + 1, message: "السجل يفتقد الاسم أو إحداثيات صالحة." }); return;
    }
    rows.push(normalizedRow({ rowNumber: index + 1, layerId: metadata.layerId || defaults?.layerId || "imported", name, nameEn: metadata.nameEn, description, latitude, longitude, municipality: metadata.municipality, category: metadata.category, source: metadata.source || defaults?.source || "KML", sourceKind: "kml", sourceRecordId: metadata.id, metadata }));
  });
  return { rows, issues, totalRows: placemarks.length };
}

const aliases: Record<string, keyof ImportRow> = { layerid: "layerId", الطبقة: "layerId", name: "name", الاسم: "name", nameen: "nameEn", الاسمبالإنجليزية: "nameEn", description: "description", الوصف: "description", latitude: "latitude", lat: "latitude", خطالعرض: "latitude", longitude: "longitude", lon: "longitude", خطالطول: "longitude", municipality: "municipality", البلدية: "municipality", category: "category", التصنيف: "category", source: "source", المصدر: "source", id: "sourceRecordId", معرف: "sourceRecordId" };
function keyOf(header: string) { return aliases[header.toLowerCase().replace(/[\s_]/g, "")] || aliases[header.replace(/[\s_]/g, "")] || undefined; }

export function parseExcel(buffer: Buffer, defaults?: { layerId?: string; source?: string }): ImportParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const first = workbook.SheetNames[0];
  if (!first) return { rows: [], issues: [{ rowNumber: 1, message: "ملف Excel لا يحتوي على ورقة عمل." }], totalRows: 0 };
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: "" });
  const rows: ImportRow[] = []; const issues: ImportIssue[] = [];
  records.forEach((record, index) => {
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(record)) { const key = keyOf(header); if (key) mapped[key] = value; }
    const name = String(mapped.name || "").trim(); const latitude = numberValue(mapped.latitude); const longitude = numberValue(mapped.longitude);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) { issues.push({ rowNumber: index + 2, message: "يجب توفير الاسم وخط العرض وخط الطول بأرقام صالحة." }); return; }
    const metadata = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? "").trim()]).filter(([, value]) => Boolean(value)));
    rows.push(normalizedRow({ rowNumber: index + 2, layerId: String(mapped.layerId || defaults?.layerId || "imported"), name, nameEn: mapped.nameEn ? String(mapped.nameEn) : undefined, description: mapped.description ? String(mapped.description) : undefined, latitude, longitude, municipality: mapped.municipality ? String(mapped.municipality) : undefined, category: mapped.category ? String(mapped.category) : undefined, source: String(mapped.source || defaults?.source || "Excel"), sourceKind: "excel", sourceRecordId: mapped.sourceRecordId ? String(mapped.sourceRecordId) : undefined, metadata }));
  });
  return { rows, issues, totalRows: records.length };
}
