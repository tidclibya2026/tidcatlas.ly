from difflib import SequenceMatcher
from pathlib import Path
import re

root = Path('/home/ubuntu/libya-tourism-atlas-app')
list_text = (root / 'docs/top-100-libya-tourism-sites.md').read_text()
current = [line.strip() for line in (root / 'docs/current-atlas-names.txt').read_text().splitlines() if line.strip() and not line.startswith('Current layer snapshot')]
rows = []
for line in list_text.splitlines():
    m = re.match(r'\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|', line)
    if m:
        rows.append((int(m.group(1)), m.group(2).strip(), m.group(3).strip()))

def norm(s):
    return re.sub(r'[^\w\u0600-\u06ff]', '', s.lower().replace('ال', ''))

confirmed_aliases = {
    'مدينة لبدة الكبرى (لبتس ماغنا)': ['مدينة لبدة الاثرية الكبرى', 'موقع لبدة الأثري (لبتس ماغنا) (لبدة الكبرى)'],
    'مدينة صبراتة الأثرية': ['موقع صبراتة الأثري', 'اثار صبراتة'],
    'مدينة شحات (قورينا) الأثرية': ['موقع شحات (قورينة) الأثري'],
    'المدينة القديمة غدامس': ['مدينة غدامس القديمة', 'غدامس'],
    'مواقع فنون الصخور في تادرارت أكاكوس': ['مواقع تادرارت أكاكوس الصخرية', 'جبال أكاكوس'],
    'شلال بالفو / شلال رأس الهلال': ['شلال بالفو'],
    'متحف غدامس': ['متحف غدامس'],
    'مدينة غات القديمة': ['المدينة القديمة غات'],
}

matches = []
for number, name, region in rows:
    n = norm(name)
    best_name, best_score = '', 0.0
    for candidate in current:
        score = SequenceMatcher(None, n, norm(candidate)).ratio()
        if n in norm(candidate) or norm(candidate) in n:
            score = max(score, 0.92)
        if score > best_score:
            best_name, best_score = candidate, score
    aliases = confirmed_aliases.get(name, [])
    confirmed = next((candidate for candidate in current if norm(name) == norm(candidate) or any(norm(alias) == norm(candidate) for alias in aliases)), None)
    if confirmed:
        status = 'موجود — اسم مطابق/بديل مؤكد'
        best_name, best_score = confirmed, 1.0
    else:
        status = 'غير محسوم — يلزم مراجعة يدوية'
        best_name, best_score = '', 0.0
    matches.append((number, name, region, status, best_name, f'{best_score:.2f}'))

out = ['# تقرير المطابقة المحافظ لقائمة المئة مع أسماء الطبقات الحالية', '', f'عدد المرشحين المقروءة: {len(rows)}', f'عدد الأسماء الحالية الفريدة: {len(current)}', 'المطابقة المؤكدة تعتمد على أسماء بديلة موثقة أو تطابق مباشر فقط؛ التشابه النصي وحده لا يعتمد لمنع التكرار.', '', '| # | المرشح | المنطقة | الحالة | الاسم الحالي المؤكد | درجة المطابقة |', '|---:|---|---|---|---|---:|']
for row in matches:
    out.append('| ' + ' | '.join(map(str, row)) + ' |')
(root / 'docs/top-150-match-report.md').write_text('\n'.join(out) + '\n')
print(f'Wrote {len(matches)} matches to docs/top-150-match-report.md')
