export type Top150ExportRow = {
  rank: number;
  candidate: string;
  region: string;
  category?: string | null;
  matchScore: number;
  reviewStatus: string;
  sourceMatches?: Array<{ lat: number; lon: number; source?: string | null }>;
};

const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function buildTop150Csv(rows: Top150ExportRow[]) {
  const header = ["الترتيب", "اسم الموقع", "المنطقة", "الفئة", "درجة المطابقة", "الحالة", "الإحداثية", "المصدر"];
  const body = rows.map((row) => [
    row.rank,
    row.candidate,
    row.region,
    row.category || "غير مصنف",
    row.matchScore,
    row.reviewStatus,
    row.sourceMatches?.[0] ? `${row.sourceMatches[0].lat}, ${row.sourceMatches[0].lon}` : "",
    row.sourceMatches?.[0]?.source || "",
  ]);
  return `\uFEFF${[header, ...body].map((line) => line.map(csvEscape).join(",")).join("\r\n")}`;
}
