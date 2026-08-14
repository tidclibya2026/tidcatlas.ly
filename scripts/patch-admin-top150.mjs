import fs from 'node:fs';
const path='client/src/pages/SystemAdmin.tsx';
let text=fs.readFileSync(path,'utf8');
const panel=fs.readFileSync('scripts/admin-top150-panel.txt','utf8');
const marker='<section className="mt-6 border-t border-[#d7c9b5] pt-5"><div><h2 className="text-xl font-bold">مقارنة ودمج السجلات المكررة</h2>';
if (!text.includes('أفضل 150 موقعًا — مراجعة تدريجية')) text=text.replace(marker,panel+marker);
fs.writeFileSync(path,text);
