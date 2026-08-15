# قالب إعدادات النسخة المستقلة

انسخ القيم التالية إلى ملف `.env` على خادم التشغيل فقط، ولا ترفع الملف إلى GitHub:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://atlas_user:change-me@127.0.0.1:3306/libya_tourism_atlas
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
APP_BASE_URL=http://localhost:3000
AUTH_MODE=local
BOOTSTRAP_ADMIN_EMAIL=admin@example.org
BOOTSTRAP_ADMIN_PASSWORD=change-this-immediately
STORAGE_DRIVER=local
STORAGE_DIR=./storage/uploads
PUBLIC_STORAGE_URL=/uploads
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=http://localhost:3000/api/auth/oidc/callback
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=© OpenStreetMap contributors

# Optional OpenAI-compatible LLM provider
AI_API_URL=
AI_API_KEY=
AI_MODEL=

# Optional notification webhook; local JSONL logging is used when empty
NOTIFICATION_WEBHOOK_URL=

# Optional Google Maps-compatible proxy/provider
MAPS_API_URL=
MAPS_API_KEY=

# Optional Whisper-compatible transcription provider
TRANSCRIPTION_API_URL=
TRANSCRIPTION_API_KEY=
```

يجب تغيير كلمة مرور المسؤول الأول وحذف قيم bootstrap بعد إنشاء الحساب. لا تُحفظ كلمات المرور أو مفاتيح التخزين أو `DATABASE_URL` في GitHub.
