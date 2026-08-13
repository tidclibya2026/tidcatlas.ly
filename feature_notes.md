# Feature Notes: إضافة نقاط وصور وبيانات وصفية

## مصدر الإرشادات
- Fullstack webdev guide: `/home/ubuntu/skills/webdev-readme-fullstack/SKILL.md`

## المتطلبات المعمارية
- المشروع أصبح React + Express + tRPC + Drizzle + MySQL/TiDB + Manus OAuth + S3 storage.
- دورة التنفيذ الرسمية: تحديث `drizzle/schema.ts`، تشغيل `pnpm drizzle-kit generate`، قراءة migration SQL، تطبيقه عبر `webdev_execute_sql`، إضافة helpers في `server/db.ts`، إضافة procedures في `server/routers.ts`، ربط الواجهة بـ `trpc.*`، ثم كتابة Vitest.
- لا تُحفظ ملفات الصور داخل قاعدة البيانات؛ تُرفع إلى S3 عبر `storagePut` ويُحفظ الرابط والمفتاح والبيانات الوصفية في DB.
- العمليات التي تعدّل أو تضيف بيانات يجب أن تكون محمية عبر `protectedProcedure` أو `adminProcedure` حسب الصلاحيات.
- المشروع بعد الترقية يحتاج حل تعارض يدوي في `client/src/pages/Home.tsx` و`package.json`، لأن الترقية أضافت ملفات fullstack وغيّرت ملفات القالب بينما واجهة الأطلس الحالية مخصصة.

## حالة المستودع الجديد
- URL: https://github.com/tidclibya2026/tidcatlas.ly
- المستودع عام، فرع `main`، commit ظاهر: `f53b69a`، ويحتوي حاليًا على `README.md` فقط.

## قرار وظيفي أولي
نظام إضافة نقطة يجب أن يشمل: اختيار الطبقة، الإحداثيات من الخريطة أو إدخالها، الاسم العربي، الاسم الإنجليزي الاختياري، الوصف، التصنيف، البلدية/المدينة، حالة السجل، مصدر البيانات، بيانات وصفية مرنة، صورة اختيارية، وحالة نشر/مراجعة. الإضافة والحذف والتعديل داخلية ومحمية، بينما العرض العام يقتصر على السجلات المنشورة.
