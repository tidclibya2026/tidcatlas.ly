<<<<<<< HEAD
# -
=======

## التشغيل المستقل عن Manus

يحتوي المستودع الآن على مسار تشغيل مستقل يستخدم المصادقة المحلية والتخزين المحلي أو S3 المتوافق وقاعدة MariaDB/MySQL. ابدأ بقراءة [المعمارية المستقلة](docs/standalone-architecture-ar.md) ثم [دليل التشغيل](docs/standalone-runbook-ar.md) و[قالب البيئة](docs/standalone-env-template.md). يمكن تشغيل البنية المحلية عبر `docker compose -f docker-compose.standalone.yml up -d --build` بعد تغيير كلمات المرور ومفتاح JWT في ملف البيئة على الخادم.

يحتوي `Dockerfile.standalone` و`.github/workflows/standalone-ci.yml` على أساس البناء والتحقق المستقل. يحفظ GitHub الكود وملفات migrations والتوثيق، بينما يجب تشغيل الباك اند وقاعدة البيانات والتخزين على خادم مستقل.
>>>>>>> origin/repair/latest-atlas-2026
