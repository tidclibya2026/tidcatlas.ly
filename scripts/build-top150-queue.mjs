import fs from 'node:fs';
const report = fs.readFileSync('docs/top-150-match-report.md','utf8');
const rows = [];
for (const line of report.split(/\r?\n/)) {
  const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*([0-9.]+)\s*\|\s*$/);
  if (!match || match[1] === '#') continue;
  const [, rank, candidate, region, status, confirmedName, score] = match;
  rows.push({ rank: Number(rank), candidate: candidate.trim(), region: region.trim(), status: status.trim(), confirmedName: confirmedName.trim() || null, matchScore: Number(score), reviewStatus: 'pending_review', sourceReport: 'docs/top-150-match-report.md' });
}
if (rows.length !== 150) throw new Error(`Expected 150 rows, got ${rows.length}`);
fs.writeFileSync('docs/top-150-review-queue-2026-08-14.json', JSON.stringify({ version: '2026-08-14', total: rows.length, policy: 'لا نشر تلقائي؛ الاعتماد من مسؤول النظام بعد مراجعة المصدر والإحداثيات والصور والحقوق.', rows }, null, 2));
console.log(`Generated ${rows.length} review rows`);
