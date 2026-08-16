# تقرير تشخيص مشكلة Git في الملف المرفق

## النتيجة المختصرة

المشكلة الظاهرة في الملف المرفق ليست عطلًا في واجهة أطلس ليبيا أو في قاعدة البيانات. الفشل حدث أثناء محاولة مزامنة نسخة Windows مع مستودع GitHub، بسبب وجود تغييرات محلية كثيرة داخل مجلد العمل، ثم محاولة تنفيذ `pull --rebase` فوق هذه التغييرات. بعد فشل الدمج استُخدم اسم remote باسم `github`، لكنه غير مُعرّف أو غير قابل للوصول في نسخة Windows، فظهر الخطأ الأخير: `fatal: 'github' does not appear to be a git repository`.

## الأدلة من الملف

| الدليل | المعنى التقني |
|---|---|
| `Your branch is up to date with 'origin/main'` | النسخة المحلية كانت على فرع `main` ومتزامنة مع remote اسمه `origin` قبل محاولة الدمج. |
| `error: cannot pull with rebase: Your index contains uncommitted changes` | توجد تغييرات staged أو غير محفوظة، ولذلك رفض Git تنفيذ rebase فوقها. |
| `Your local changes ... would be overwritten by merge` | التغييرات المحلية تشمل ملفات أساسية مثل `Home.tsx` و`package.json` وملفات البيانات؛ تنفيذ pull بالقوة قد يفقدها. |
| `Merge with strategy ort failed` | محاولة الدمج فشلت، ولم تُحل حالة Git بإكمال الدمج أو إلغائه. |
| `fatal: 'github' does not appear to be a git repository` | أمر الدفع استخدم remote باسم `github` غير موجود أو لا يملك رابطًا/اعتمادًا صالحًا في نسخة Windows. |
| آلاف أسطر `trailing whitespace` | تحذيرات تنسيق أثناء الدمج، وليست السبب الرئيسي للفشل. |

## السبب الجذري

تم التعامل مع مجلد يحتوي على نسخة مشروع كاملة أو ملفات من مصدر مختلف باعتباره working tree عاديًا، ثم نُفذ `git pull --rebase` قبل حفظ التغييرات أو عزلها. بذلك حاول Git دمج ملفات كثيرة سبق تعديلها أو حذفها محليًا مع `origin/main`. بعد فشل الدمج لم يعد من الآمن تنفيذ `git add .` أو `git push --force`، لأن ذلك قد يرفع حذفًا جماعيًا للبيانات أو يطمس تاريخ المستودع.

يوجد سبب مستقل ثاني: اسم remote المستخدم للدفع هو `github`، بينما سجل الملف يثبت أن المزامنة السابقة كانت مع `origin`. يجب فحص `git remote -v` واستخدام الاسم الذي يظهر فعليًا، وغالبًا يكون `origin`، أو تعريف remote جديد بعنوان GitHub ثم تسجيل الدخول.

## الحل الآمن على Windows / VS Code

نفّذ الأوامر التالية من PowerShell داخل مجلد النسخة التي تريد الاحتفاظ بتغييراتها. لا تستخدم `git reset --hard` ولا `git push --force`.

```powershell
cd C:\libya-tourism-atlas-app-clean

git rev-parse --show-toplevel
git status --short
git remote -v
```

إذا ظهر أن merge أو rebase ما زال قيد التنفيذ، ألغِ العملية فقط، من دون حذف التغييرات المحلية:

```powershell
git merge --abort 2>$null
if ($LASTEXITCODE -ne 0) { git rebase --abort 2>$null }
git status
```

بعد ذلك احفظ نسخة احتياطية من التغييرات المحلية قبل أي pull:

```powershell
git diff --binary > ..\atlas-local-working.patch
git diff --cached --binary >> ..\atlas-local-working.patch
git stash push -u -m "backup before atlas github sync"
```

صحّح remote باسم `origin` بدل استعمال `github` غير الموجود:

```powershell
git remote -v
git remote set-url origin https://github.com/tidclibya2026/tidcatlas.ly.git
```

إذا لم يكن `origin` موجودًا، استخدم:

```powershell
git remote add origin https://github.com/tidclibya2026/tidcatlas.ly.git
```

ثم اجلب معلومات GitHub فقط، من دون دمج تلقائي:

```powershell
git fetch origin
```

## المسار الموصى به للنسخة النظيفة

بسبب عدد الملفات الكبير في سجل التعارض، المسار الأكثر أمانًا هو عدم إصلاح الدمج داخل المجلد المتضرر. احتفظ به كنسخة احتياطية، وأنشئ clone جديدًا:

```powershell
cd C:\
Rename-Item libya-tourism-atlas-app-clean libya-tourism-atlas-app-conflict-backup

git clone https://github.com/tidclibya2026/tidcatlas.ly.git libya-tourism-atlas-app-clean
cd libya-tourism-atlas-app-clean
pnpm install
pnpm check
pnpm test
pnpm build
```

هذا المسار يثبت أن نسخة GitHub سليمة، لكنه لا يرفع تلقائيًا آخر checkpoint المحفوظ في Manus؛ آخر نسخة تشغيلية محفوظة للمشروع هي النسخة المشار إليها في المحادثة. لذلك يجب عدم نسخ ملفات `dist` أو ملفات KML القديمة عشوائيًا فوق clone الجديد. إذا كان المطلوب رفع آخر نسخة من بيئة Manus إلى GitHub، يلزم أولًا تسجيل الدخول إلى GitHub في VS Code أو GitHub CLI، ثم تنفيذ push من مجلد المصدر الصحيح بعد مراجعة الفرق.

## التحقق النهائي

بعد الوصول إلى نسخة نظيفة، تحقق من النقاط التالية:

```powershell
git status
git grep -n -E "^(<<<<<<<|=======|>>>>>>> )" -- .
Test-Path .\package.json
Test-Path .\server\_core\index.ts
pnpm check
pnpm test
pnpm build
pnpm dev
```

ثم افتح `http://localhost:3000/public`. يجب أن يظهر غلاف الأطلس أولًا، ثم يمكن الدخول إلى الخريطة. لا تُنفذ `git pull --rebase` فوق ملفات معدلة، ولا تُنفذ `git push --force` قبل مراجعة `git diff --stat` و`git status`.

## الخلاصة

الإجراء الصحيح هو **إلغاء حالة الدمج، حفظ التغييرات، تصحيح remote، ثم العمل من clone نظيف أو من نسخة مصدر موثوقة**. لا توجد في الملف علامة تثبت أن قاعدة البيانات أو منطق الصور أو دمج الفنادق هو سبب الخطأ. الخطأ الحالي إداري في Git: working tree متضارب مع `origin/main`، مع remote باسم `github` غير صالح أو غير مُعرّف.
