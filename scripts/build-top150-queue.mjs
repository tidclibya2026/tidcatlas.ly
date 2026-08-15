import fs from 'node:fs';
const report = fs.readFileSync('docs/top-150-match-report.md','utf8');
const rows = [];
for (const line of report.split(/\r?\n/)) {
  if (!/^\|\s*\d+\s*\|/.test(line)) continue;
  const fields = line.split('|').slice(1, -1).map((value) => value.trim());
  if (fields.length !== 6) continue;
  const [rank, candidate, region, status, confirmedName, score] = fields;
  rows.push({ rank: Number(rank), candidate, region, status, confirmedName: confirmedName || null, matchScore: Number(score), reviewStatus: 'pending_review', sourceReport: 'docs/top-150-match-report.md' });
}
if (rows.length !== 150) throw new Error(`Expected 150 rows, got ${rows.length}`);
fs.writeFileSync('docs/top-150-review-queue-2026-08-14.json', JSON.stringify({ version: '2026-08-14', total: rows.length, policy: 'لا نشر تلقائي؛ الاعتماد من مسؤول النظام بعد مراجعة المصدر والإحداثيات والصور والحقوق.', rows }, null, 2));
console.log(`Generated ${rows.length} review rows`);
