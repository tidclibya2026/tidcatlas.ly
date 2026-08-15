import fs from 'node:fs';
const path = 'server/routers.ts';
let text = fs.readFileSync(path, 'utf8');
text = text.replace('import { promisify } from "node:util";', 'import { promisify } from "node:util";\nimport { readFile } from "node:fs/promises";\nimport { resolve } from "node:path";');
const marker = '    reviewQueue: documentationProcedure.input(z.object({ recordStatus: z.enum(["draft", "pending_review", "approved", "published", "rejected", "archived"]).optional(), search: z.string().max(255).optional(), layerId: z.string().max(80).optional(), municipality: z.string().max(160).optional(), category: z.string().max(120).optional(), sort: z.enum(["newest", "oldest", "name"]).optional() }).optional()).query(({ input }) => listReviewQueue(input?.recordStatus, input)),';
const addition = `${marker}\n    sourceReconciliation: adminProcedure.query(async () => {\n      const root = process.cwd();\n      const [summaryText, manifestText, reportText] = await Promise.all([\n        readFile(resolve(root, "docs/normalized-attached-sources-2026-08-14.jsonl.summary.json"), "utf8"),\n        readFile(resolve(root, "docs/import-job-attached-sources-2026-08-14.json"), "utf8"),\n        readFile(resolve(root, "docs/attached-source-reconciliation-2026-08-14.md"), "utf8"),\n      ]);\n      return { summary: JSON.parse(summaryText), manifest: JSON.parse(manifestText), report: reportText };\n    }),`;
if (!text.includes('sourceReconciliation:')) text = text.replace(marker, addition);
fs.writeFileSync(path, text);
