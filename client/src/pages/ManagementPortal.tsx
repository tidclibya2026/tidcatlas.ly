import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
<<<<<<< HEAD
import { startLogin } from "@/const";
=======
import { getManagementUrl, isGithubPagesHost, PUBLISHED_MANAGEMENT_URL, startLogin } from "@/const";
>>>>>>> origin/repair/latest-atlas-2026
import { Link } from "wouter";
import { Database, FileCheck2, ShieldCheck } from "lucide-react";

export default function ManagementPortal() {
  const { user, loading } = useAuth();
  const [loginMessage, setLoginMessage] = useState("");
<<<<<<< HEAD
  const handleLogin = () => {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
    const appId = import.meta.env.VITE_APP_ID as string | undefined;
    if (!oauthPortalUrl || !appId) {
      setLoginMessage("تسجيل الدخول المحلي غير مهيأ بعد. أضف VITE_OAUTH_PORTAL_URL وVITE_APP_ID إلى ملف البيئة ثم أعد تشغيل pnpm dev، أو افتح رابط الإدارة المنشور.");
      return;
    }
    startLogin();
  };
  if (loading) return <main className="min-h-screen grid place-items-center bg-[#f4efe5] text-[#123c52]">جارٍ التحقق من الدخول…</main>;
  if (!user) return <main dir="rtl" className="min-h-screen grid place-items-center bg-[#f4efe5] p-6 text-[#123c52]"><section className="max-w-xl border border-[#d7c9b5] bg-white/80 p-8 text-center"><ShieldCheck className="mx-auto text-[#b86f3c]" size={42} /><h1 className="mt-4 text-3xl font-black">المسار الداخلي للأطلس</h1><p className="mt-3 text-slate-600">هذا المسار مخصص لمسؤول النظام وفريق التوثيق والمراجعين. سجّل الدخول بالحساب المؤسسي للمتابعة.</p><Button className="mt-5 bg-[#123c52]" onClick={handleLogin}>دخول الإدارة الداخلية</Button>{loginMessage && <p role="alert" className="mt-4 border border-[#d7c9b5] bg-[#fff8ed] p-3 text-sm leading-7 text-[#7d4d2a]">{loginMessage}</p>}<Link href="/public"><Button className="mt-5 mr-2" variant="outline">العودة للمسار العام</Button></Link></section></main>;
=======
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localLoginPending, setLocalLoginPending] = useState(false);
  const isGithubPages = isGithubPagesHost();
  const hasOAuth = Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
  const handleLocalLogin = async () => {
    setLocalLoginPending(true);
    setLoginMessage("");
    try {
      const response = await fetch("/api/auth/local/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: localEmail, password: localPassword }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "تعذر تسجيل الدخول");
      window.location.reload();
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "تعذر تسجيل الدخول");
    } finally {
      setLocalLoginPending(false);
    }
  };
  const handleLogin = () => {
    if (!hasOAuth) return void handleLocalLogin();
    startLogin();
  };
  if (loading) return <main className="min-h-screen grid place-items-center bg-[#f4efe5] text-[#123c52]">جارٍ التحقق من الدخول…</main>;
  if (isGithubPages) return <main dir="rtl" className="min-h-screen grid place-items-center bg-[#f4efe5] p-6 text-[#123c52]"><section className="max-w-xl border border-[#d7c9b5] bg-white/80 p-8 text-center"><ShieldCheck className="mx-auto text-[#b86f3c]" size={42} /><h1 className="mt-4 text-3xl font-black">الإدارة لا تعمل من GitHub Pages</h1><p className="mt-3 text-slate-600">GitHub Pages مخصص للعرض العام فقط. افتح نطاق Manus المنشور لتسجيل الدخول الإداري وتجنب خطأ redirect_uri.</p><Button className="mt-5 bg-[#123c52]" onClick={() => { window.location.href = PUBLISHED_MANAGEMENT_URL; }}>فتح بوابة الإدارة المنشورة</Button><Link href="/public"><Button className="mt-5 mr-2" variant="outline">العودة للمسار العام</Button></Link></section></main>;
  if (!user) return <main dir="rtl" className="min-h-screen grid place-items-center bg-[#f4efe5] p-6 text-[#123c52]"><section className="max-w-xl border border-[#d7c9b5] bg-white/80 p-8 text-center"><ShieldCheck className="mx-auto text-[#b86f3c]" size={42} /><h1 className="mt-4 text-3xl font-black">المسار الداخلي للأطلس</h1><p className="mt-3 text-slate-600">هذا المسار مخصص لمسؤول النظام وفريق التوثيق والمراجعين. سجّل الدخول بالحساب المؤسسي للمتابعة.</p>{!hasOAuth && <div className="mt-5 grid gap-3 text-right"><label className="text-sm font-bold">البريد الإلكتروني<input className="mt-1 w-full border border-[#d7c9b5] bg-white p-2" type="email" value={localEmail} onChange={(event) => setLocalEmail(event.target.value)} autoComplete="email" /></label><label className="text-sm font-bold">كلمة المرور<input className="mt-1 w-full border border-[#d7c9b5] bg-white p-2" type="password" value={localPassword} onChange={(event) => setLocalPassword(event.target.value)} autoComplete="current-password" /></label></div>}<Button className="mt-5 bg-[#123c52]" onClick={handleLogin} disabled={localLoginPending}>{localLoginPending ? "جارٍ الدخول…" : "دخول الإدارة الداخلية"}</Button>{loginMessage && <p role="alert" className="mt-4 border border-[#d7c9b5] bg-[#fff8ed] p-3 text-sm leading-7 text-[#7d4d2a]">{loginMessage}</p>}<Link href="/public"><Button className="mt-5 mr-2" variant="outline">العودة للمسار العام</Button></Link></section></main>;
>>>>>>> origin/repair/latest-atlas-2026
  return <main dir="rtl" className="min-h-screen bg-[#f4efe5] p-6 text-[#123c52] md:p-10"><section className="mx-auto max-w-5xl"><header className="border-b border-[#d7c9b5] pb-6"><span className="text-xs font-bold tracking-[0.2em] text-[#b86f3c]">TIDC · INTERNAL WORKSPACE</span><h1 className="mt-2 text-4xl font-black">المسار الداخلي للأطلس</h1><p className="mt-2 text-slate-600">مسؤول النظام · فريق التوثيق · المراجعة والاستيراد.</p></header><div className="mt-8 grid gap-5 md:grid-cols-3"><Link href="/system-admin"><section className="h-full border border-[#d7c9b5] bg-white/80 p-6"><ShieldCheck className="text-[#b86f3c]" /><h2 className="mt-4 text-xl font-bold">مسؤول النظام</h2><p className="mt-2 text-sm text-slate-600">إدارة المستخدمين والصلاحيات والنسخ الاحتياطية.</p></section></Link><Link href="/documentation-team"><section className="h-full border border-[#d7c9b5] bg-white/80 p-6"><FileCheck2 className="text-[#287a70]" /><h2 className="mt-4 text-xl font-bold">فريق التوثيق والمراجعة</h2><p className="mt-2 text-sm text-slate-600">إضافة النقاط، مراجعة الصور، واستيراد KML وExcel.</p></section></Link><Link href="/public"><section className="h-full border border-[#d7c9b5] bg-white/80 p-6"><Database className="text-[#3e7183]" /><h2 className="mt-4 text-xl font-bold">المسار العام</h2><p className="mt-2 text-sm text-slate-600">فتح نسخة الزوار والسواح من الأطلس.</p></section></Link></div><p className="mt-8 text-sm text-slate-500">الحساب الحالي: {user.name || user.email || "الحساب المؤسسي"}</p></section></main>;
}
