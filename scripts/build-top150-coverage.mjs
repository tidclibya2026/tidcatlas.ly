import fs from 'node:fs';
const queue = JSON.parse(fs.readFileSync('docs/top-150-review-queue-2026-08-14.json','utf8'));
const confirmed = queue.rows.filter((row) => row.matchScore === 1);
const manual = queue.rows.filter((row) => row.matchScore < 1);
const lines = [
  '# تقرير تغطية أفضل 150 — 2026-08-14',
  '',
  'هذا التقرير يحدد نطاق المراجعة ولا يعتبر اعتمادًا أو نشرًا للمواقع.',
  '',
  '| المؤشر | العدد |',
  '|---|---:|',
  `| إجمالي المرشحين | ${queue.rows.length} |`,
  `| مطابقة مؤكدة بالاسم/البديل | ${confirmed.length} |`,
  `| تحتاج مراجعة يدوية | ${manual.length} |`,
  `| سجلات لا يجوز نشرها قبل التحقق من الإحداثيات | ${manual.length} |`,
  '',
  '## سياسة المراجعة',
  '',
  'لا ينتقل أي سجل إلى النشر إلا بعد التحقق من الاسم والإحداثيات والطبقة والوصف ومصدر الصورة وحقوق استخدامها. السجلات ذات المطابقة المؤكدة تحتاج أيضًا مراجعة الصور والحقوق؛ أما السجلات غير المحسومة فتحتاج تحديدًا يدويًا من فريق التوثيق.',
  '',
  '## مصادر القائمة',
  '',
  '- `docs/top-150-match-report.md`',
  '- `docs/top-150-review-queue-2026-08-14.json`',
  '- ملفات GeoJSON وKML المؤرشفة داخل وثائق المشروع.',
];
fs.writeFileSync('docs/top-150-coverage-2026-08-14.md', lines.join('\n') + '\n');
console.log({ total: queue.rows.length, confirmed: confirmed.length, manual: manual.length });
