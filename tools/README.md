# مستورد صور KML

يوفر `import_kml_images.py` مسارًا آمنًا لاستكشاف روابط الصور داخل ملفات KML، مع دعم الوصف المضمن داخل `CDATA` ووسوم HTML وحقول `Data` و`SimpleData` وحقول الصور الشائعة مثل `photo_URL` و`PictureUrl`.

## التشغيل في وضع القراءة فقط

الوضع الافتراضي لا ينزّل أي ملف؛ بل يقرأ KML وينشئ manifest منظمًا:

```bash
python3 tools/import_kml_images.py data/site.kml \
  --manifest imported-images/manifest.json
```

## التنزيل المحلي الصريح

يجب استخدام `--download` صراحة. ويُفضّل تقييد النطاقات المسموح بها باستخدام `--allow-host` حتى لا يتم الاتصال بروابط غير موثوقة داخل ملف KML:

```bash
python3 tools/import_kml_images.py data/site.kml \
  --download \
  --allow-host upload.wikimedia.org \
  --allow-host commons.wikimedia.org \
  --output-dir imported-images \
  --manifest imported-images/manifest.json
```

ينشئ السكربت اسمًا مبنيًا على SHA-256، ويحفظ لكل سجل رابط المصدر، واسم الموقع، والإحداثيات، والمؤلف، والترخيص، ونوع المحتوى، والحالة، ومسار الملف المحلي. لا تُستبدل الصور ذات المصدر المفقود بصورة عامة.

## التخزين الدائم

داخل مشروع الأطلس، المسار الإنتاجي المفضل هو رفع bytes إلى `storagePut` في الخادم، ثم حفظ المفتاح والرابط الناتج في قاعدة البيانات. السكربت يدعم تكاملًا اختياريًا مع مخزن متوافق عبر رابط PUT موقّع:

```bash
python3 tools/import_kml_images.py data/site.kml \
  --download \
  --output-dir imported-images \
  --upload-url-template 'https://storage.example/upload/{key}?signature=...'
```

لا تضع مفاتيح الوصول أو الروابط الموقعة داخل المستودع أو manifest المنشور. استخدم رابطًا قصير العمر من خدمة التخزين، أو نفّذ الرفع من خادم المشروع عبر `storagePut`، ثم خزّن `key` وبيانات الحقوق فقط.

## ملاحظات حقوق الملكية

السكربت لا يفترض أن الصورة قابلة لإعادة الاستخدام لمجرد وجود رابط لها. يجب مراجعة المصدر والترخيص والمؤلف قبل النشر العام، وإظهار هذه البيانات في نافذة تفاصيل الموقع. استخدم الوضع الافتراضي parse-only عند فحص ملفات KML من جهات غير معروفة، ثم فعّل التنزيل بعد اعتماد النطاقات والمصادر.
