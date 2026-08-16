import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const isGitHubPagesHost = (hostname: string) => hostname.endsWith("github.io");

export const startLogin = () => {
  if (typeof window !== "undefined" && isGitHubPagesHost(window.location.hostname)) {
    const adminUrl = import.meta.env.VITE_ADMIN_APP_URL as string | undefined;
    if (adminUrl) {
      window.location.href = adminUrl;
      return;
    }
    window.alert("تسجيل الدخول الإداري يعمل من نطاق الخادم الكامل فقط، وليس من نسخة GitHub Pages العامة. افتح رابط الإدارة المؤسسي.");
    return;
  }
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  const appId = import.meta.env.VITE_APP_ID as string | undefined;
  if (!oauthPortalUrl || !appId) {
    window.alert("إعدادات تسجيل الدخول غير موجودة في النسخة المحلية. استخدم رابط الإدارة المنشور أو أضف VITE_OAUTH_PORTAL_URL وVITE_APP_ID إلى ملف البيئة ثم أعد تشغيل الخادم.");
    return;
  }
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
