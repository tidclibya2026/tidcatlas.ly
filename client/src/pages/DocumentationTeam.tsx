import { useCallback, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapView } from "@/components/Map";
import { MapPinned, MousePointer2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";

const documentationLayers = [
  { id: "heritage", label: "التراث العالمي" },
  { id: "historic-cities", label: "المدن التاريخية" },
  { id: "museums", label: "المتاحف" },
  { id: "natural", label: "المواقع الطبيعية" },
  { id: "hotels", label: "الفنادق والإيواء" },
  { id: "resorts", label: "القرى والمنتجعات" },
  { id: "investment", label: "فرص الاستثمار" },
  { id: "services", label: "الخدمات" },
  { id: "restaurants", label: "المطاعم" },
  { id: "cafes", label: "المقاهي" },
] as const;

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  rejected: "مرفوض",
  archived: "مؤرشف",
};

export default function DocumentationTeam() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"draft" | "pending_review" | "approved" | "published" | "rejected" | "archived">("pending_review");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [form, setForm] = useState({ layerId: "heritage", name: "", description: "", latitude: "", longitude: "", municipality: "", category: "", source: "ملف TIDC", sourceKind: "kml" as "kml" | "excel" | "agency" | "web_page" | "facebook" | "other" });
  const utils = trpc.useUtils();
  const queue = trpc.atlas.reviewQueue.useQuery({ recordStatus: status }, { enabled: user?.role === "admin" });
  const importJobs = trpc.atlas.importJobs.useQuery(undefined, { enabled: user?.role === "admin" });
  const createPoint = trpc.atlas.create.useMutation({ onSuccess: () => { toast.success("تم حفظ النقطة كمسودة"); queue.refetch(); }, onError: (error) => toast.error(error.message) });
  const updatePoint = trpc.atlas.update.useMutation({ onSuccess: () => { toast.success("تم تحديث النقطة"); queue.refetch(); }, onError: (error) => toast.error(error.message) });
  const reviewPoint = trpc.atlas.review.useMutation({ onSuccess: () => { toast.success("تم تحديث حالة المراجعة"); queue.refetch(); }, onError: (error) => toast.error(error.message) });
  const duplicateQuery = trpc.atlas.findDuplicates.useQuery({ name: form.name || "غير محدد", latitude: Number(form.latitude) || 0, longitude: Number(form.longitude) || 0 }, { enabled: form.name.length > 2 && Boolean(form.latitude) && Boolean(form.longitude) && user?.role === "admin" });
  const details = trpc.atlas.pointDetails.useQuery({ id: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRights, setImageRights] = useState({ sourceKind: "agency" as "agency" | "photographer" | "web_page" | "facebook" | "kml" | "other", sourceUrl: "", ownerName: "", photographerName: "", license: "", rightsNote: "الصورة مقدمة للتوثيق، ويجب مراجعة حق استخدامها قبل النشر." });
  const addImage = trpc.atlas.addImage.useMutation({ onSuccess: () => { toast.success("تمت إضافة الصورة وبقيت قيد مراجعة الحقوق"); details.refetch(); setImageFile(null); }, onError: (error) => toast.error(error.message) });
  const mergeDuplicate = trpc.atlas.mergeDuplicate.useMutation({ onSuccess: () => { toast.success("تم دمج السجل وأرشفة التكرار"); duplicateQuery.refetch(); queue.refetch(); }, onError: (error) => toast.error(error.message) });
  const archivePoint = trpc.atlas.archive.useMutation({ onSuccess: () => { toast.success("تمت أرشفة النقطة"); queue.refetch(); }, onError: (error) => toast.error(error.message) });
  const reviewImage = trpc.atlas.reviewImage.useMutation({ onSuccess: () => { toast.success("تم تحديث حالة الصورة"); details.refetch(); }, onError: (error) => toast.error(error.message) });
  const archiveImage = trpc.atlas.archiveImage.useMutation({ onSuccess: () => { toast.success("تمت أرشفة الصورة"); details.refetch(); }, onError: (error) => toast.error(error.message) });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importKind, setImportKind] = useState<"kml" | "excel">("kml");
  const [importLayer, setImportLayer] = useState("heritage");
  const [importData, setImportData] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ totalRows: number; rows: Array<{ name: string; latitude: number; longitude: number }>; issues: Array<{ rowNumber: number; message: string }> } | null>(null);
  const previewImport = trpc.atlas.previewImport.useMutation({ onSuccess: (result) => { setImportPreview(result); toast.success(`تمت معاينة ${result.totalRows} صفًا`); }, onError: (error) => toast.error(error.message) });
  const startImport = trpc.atlas.startImport.useMutation({ onError: (error) => toast.error(error.message) });
  const commitImport = trpc.atlas.commitImport.useMutation({ onSuccess: (result) => { toast.success(`تم استيراد ${result.importedRows} نقطة، مع ${result.duplicateRows} تكرار و${result.rejectedRows} أخطاء`); queue.refetch(); }, onError: (error) => toast.error(error.message) });

  const isAdmin = user?.role === "admin";
  const rows = useMemo(() => queue.data ?? [], [queue.data]);
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const handleMapReady = useCallback((readyMap: L.Map) => {
    setMap(readyMap);
    readyMap.on("click", (event: L.LeafletMouseEvent) => {
      const latitude = event.latlng.lat.toFixed(6);
      const longitude = event.latlng.lng.toFixed(6);
      setForm((current) => ({ ...current, latitude, longitude }));
      markerRef.current?.remove();
      markerRef.current = L.marker(event.latlng).addTo(readyMap).bindTooltip(`${latitude}, ${longitude}`, { permanent: true, direction: "top" }).openTooltip();
      toast.success(`تم اختيار النقطة: ${latitude}، ${longitude}`);
    });
  }, []);
  const focusCoordinates = () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!map || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return toast.error("أدخل خط العرض والطول بشكل صحيح أولًا");
    const point = L.latLng(latitude, longitude);
    if (!L.latLngBounds([18.8, 8.2], [34.2, 25.6]).contains(point)) return toast.error("الإحداثيات يجب أن تكون داخل نطاق ليبيا");
    markerRef.current?.remove();
    markerRef.current = L.marker(point).addTo(map).bindTooltip(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, { permanent: true, direction: "top" }).openTooltip();
    map.setView(point, Math.max(map.getZoom(), 10));
  };
  const readImportFile = async (file: File) => { setImportFile(file); setImportData(await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = reject; reader.readAsDataURL(file); })); };
  const previewSelectedImport = () => { if (!importFile || !importData) return toast.error("اختر ملفًا أولًا"); previewImport.mutate({ sourceKind: importKind, fileName: importFile.name, fileDataBase64: importData, layerId: importLayer }); };
  const commitSelectedImport = async () => { if (!importFile || !importData || !importPreview) return toast.error("نفّذ المعاينة أولًا"); const job = await startImport.mutateAsync({ sourceKind: importKind, fileName: importFile.name, fileDataBase64: importData }); commitImport.mutate({ jobId: job.id, sourceKind: importKind, fileName: importFile.name, layerId: importLayer }); importJobs.refetch(); };
  const submitImage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) return toast.error("اختر نقطة أولًا");
    let imageDataUrl: string | undefined;
    if (imageFile) imageDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(imageFile); });
    addImage.mutate({ pointId: selectedId, imageDataUrl, fileName: imageFile?.name, contentType: imageFile?.type, imageUrl: !imageFile && imageRights.sourceUrl ? imageRights.sourceUrl : undefined, sourceKind: imageRights.sourceKind, sourceUrl: imageRights.sourceUrl || undefined, ownerName: imageRights.ownerName || undefined, photographerName: imageRights.photographerName || undefined, license: imageRights.license || undefined, rightsNote: imageRights.rightsNote, rightsWarning: true, isPrimary: false });
  };
  const submitPoint = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { layerId: form.layerId, name: form.name, description: form.description || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude), municipality: form.municipality || undefined, category: form.category || undefined, source: form.source || undefined, sourceKind: form.sourceKind };
    if (selectedId) updatePoint.mutate({ id: selectedId, patch: payload });
    else createPoint.mutate(payload);
  };

  if (loading) return <main className="min-h-screen grid place-items-center bg-[#f4efe5] text-[#123c52]">جارٍ التحقق من صلاحية فريق التوثيق…</main>;
  if (!isAdmin) return <main dir="rtl" className="min-h-screen grid place-items-center bg-[#f4efe5] p-6 text-[#123c52]"><section className="max-w-lg text-center"><p className="text-sm uppercase tracking-[0.2em] text-[#b86f3c]">نظام التوثيق الداخلي</p><h1 className="mt-3 text-3xl font-bold">هذه الصفحة مخصصة لفريق التوثيق</h1><p className="mt-4 text-slate-600">يلزم تسجيل الدخول بحساب إداري لإضافة النقاط ومراجعتها ونشرها.</p><Link href="/"><Button className="mt-6 bg-[#123c52]">العودة إلى الأطلس</Button></Link></section></main>;

  return <main dir="rtl" className="min-h-screen bg-[#f4efe5] text-[#123c52] p-4 md:p-8">
    <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-[#d7c9b5] pb-5"><div><p className="text-xs font-bold tracking-[0.18em] text-[#b86f3c]">TIDC · GIS CONTENT DESK</p><h1 className="mt-2 text-3xl font-black">فريق توثيق أطلس ليبيا</h1><p className="mt-1 text-sm text-slate-600">استيراد ومراجعة وإدارة النقاط والصور قبل نشرها للزوار.</p></div><Link href="/"><Button variant="outline">العودة للخريطة</Button></Link></header>      <section className="mx-auto mt-6 max-w-7xl border border-[#d7c9b5] bg-white/70 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">خريطة اختيار موقع التوثيق</h2><p className="text-sm text-slate-600">انقر على الخريطة لوضع دبوس، وستنتقل الإحداثيات تلقائيًا إلى نموذج النقطة.</p></div><span className="flex items-center gap-1 text-sm text-[#287a70]"><MapPinned size={16} /> نطاق ليبيا فقط</span></div><div className="mt-4"><MapView className="h-[420px]" initialCenter={[27.2, 17.2]} initialZoom={5} onMapReady={handleMapReady} /></div><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">الإحداثيات الحالية:</span><code className="border border-[#d7c9b5] bg-[#fbf8f2] px-3 py-1">{form.latitude || "—"}, {form.longitude || "—"}</code><Button type="button" variant="outline" onClick={focusCoordinates}><MousePointer2 size={15} /> إظهار الإحداثيات على الخريطة</Button></div></section><section className="mx-auto mt-6 max-w-7xl border border-[#d7c9b5] bg-white/70 p-4"><div className="flex flex-wrap items-center gap-3"><h2 className="font-bold">استيراد KML / Excel</h2><select className="border border-[#d7c9b5] bg-white p-2" value={importKind} onChange={(e) => setImportKind(e.target.value as typeof importKind)}><option value="kml">KML</option><option value="excel">Excel</option></select><select className="border border-[#d7c9b5] bg-white p-2" value={importLayer} onChange={(e) => setImportLayer(e.target.value)}><option value="heritage">التراث العالمي</option><option value="natural">الموارد الطبيعية</option><option value="hotels">الفنادق</option><option value="services">الخدمات</option><option value="restaurants">المطاعم</option><option value="cafes">المقاهي</option></select><input type="file" accept={importKind === "kml" ? ".kml,application/vnd.google-earth.kml+xml" : ".xlsx,.xls"} onChange={(e) => e.target.files?.[0] && readImportFile(e.target.files[0])} /><Button type="button" variant="outline" onClick={previewSelectedImport}>معاينة</Button><Button type="button" className="bg-[#123c52]" disabled={!importPreview} onClick={commitSelectedImport}>تثبيت في قاعدة البيانات</Button></div>{importPreview && <div className="mt-3 text-sm"><p>الصفوف: {importPreview.totalRows} · صالح للعرض: {importPreview.rows.length} · أخطاء: {importPreview.issues.length}</p>{importPreview.issues.map((issue) => <p key={issue.rowNumber} className="text-red-700">صف {issue.rowNumber}: {issue.message}</p>)}</div>}{importJobs.data?.length ? <div className="mt-4 border-t border-[#d7c9b5] pt-3"><h3 className="font-semibold">سجل عمليات الاستيراد</h3><div className="mt-2 space-y-1 text-xs">{importJobs.data.slice(0, 10).map((job) => <div key={job.id} className="flex flex-wrap justify-between gap-2 border border-[#e1d5c4] p-2"><span>#{job.id} · {job.fileName} · {job.status}</span><span>مستورد: {job.importedRows} · تكرار: {job.duplicateRows} · مرفوض: {job.rejectedRows}</span>{job.errorSummary && <details className="w-full"><summary className="cursor-pointer text-red-700">عرض تفاصيل الأخطاء</summary><pre className="mt-1 whitespace-pre-wrap text-red-700">{job.errorSummary}</pre></details>}</div>)}</div></div> : null}</section>
    <div className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="border border-[#d7c9b5] bg-white/70 p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">إضافة أو تعديل نقطة</h2>{selectedId && <Button variant="ghost" onClick={() => { setSelectedId(null); setForm({ layerId: "heritage", name: "", description: "", latitude: "", longitude: "", municipality: "", category: "", source: "ملف TIDC", sourceKind: "kml" }); }}>نقطة جديدة</Button>}</div><form className="mt-4 space-y-3" onSubmit={submitPoint}><label className="block text-sm font-semibold">طبقة التوثيق<select className="mt-1 w-full border border-[#d7c9b5] bg-white p-2" value={form.layerId} onChange={(e) => setField("layerId", e.target.value)}>{documentationLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select></label><Input placeholder="اسم الموقع" value={form.name} onChange={(e) => setField("name", e.target.value)} required /><Textarea placeholder="الوصف والمعلومات الوصفية" value={form.description} onChange={(e) => setField("description", e.target.value)} /><div className="grid grid-cols-2 gap-3"><Input placeholder="خط العرض" inputMode="decimal" value={form.latitude} onChange={(e) => setField("latitude", e.target.value)} required /><Input placeholder="خط الطول" inputMode="decimal" value={form.longitude} onChange={(e) => setField("longitude", e.target.value)} required /></div><div className="grid grid-cols-2 gap-3"><Input placeholder="البلدية" value={form.municipality} onChange={(e) => setField("municipality", e.target.value)} /><Input placeholder="التصنيف" value={form.category} onChange={(e) => setField("category", e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><Input placeholder="المصدر" value={form.source} onChange={(e) => setField("source", e.target.value)} /><select className="border border-[#d7c9b5] bg-white p-2" value={form.sourceKind} onChange={(e) => setField("sourceKind", e.target.value)}><option value="kml">KML</option><option value="excel">Excel</option><option value="agency">جهة مالكة</option><option value="web_page">صفحة ويب</option><option value="facebook">Facebook</option><option value="other">أخرى</option></select></div>{duplicateQuery.data?.length ? <p className="border-r-4 border-[#b86f3c] bg-[#fff5ea] p-3 text-sm text-[#8a4b21]">تنبيه: توجد {duplicateQuery.data.length} نقاط محتملة التكرار قريبة من الاسم والإحداثيات. راجعها قبل الحفظ أو استخدم إجراء الدمج.</p> : null}<Button type="submit" className="w-full bg-[#123c52]">{selectedId ? "حفظ التعديل" : "إضافة النقطة كمسودة"}</Button></form>{selectedId && <section className="mt-5 border-t border-[#d7c9b5] pt-5"><h3 className="font-bold">إدارة صور وحقوق النقطة</h3><form className="mt-3 space-y-2" onSubmit={submitImage}><input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} /><Input placeholder="رابط المصدر أو الصفحة" value={imageRights.sourceUrl} onChange={(e) => setImageRights((v) => ({ ...v, sourceUrl: e.target.value }))} /><div className="grid grid-cols-2 gap-2"><Input placeholder="الجهة المالكة" value={imageRights.ownerName} onChange={(e) => setImageRights((v) => ({ ...v, ownerName: e.target.value }))} /><Input placeholder="اسم المصور" value={imageRights.photographerName} onChange={(e) => setImageRights((v) => ({ ...v, photographerName: e.target.value }))} /></div><div className="grid grid-cols-2 gap-2"><Input placeholder="الترخيص" value={imageRights.license} onChange={(e) => setImageRights((v) => ({ ...v, license: e.target.value }))} /><select className="border border-[#d7c9b5] bg-white p-2" value={imageRights.sourceKind} onChange={(e) => setImageRights((v) => ({ ...v, sourceKind: e.target.value as typeof v.sourceKind }))}><option value="agency">جهة مالكة</option><option value="photographer">مصور</option><option value="facebook">Facebook</option><option value="web_page">صفحة ويب</option><option value="kml">KML</option><option value="other">أخرى</option></select></div><Textarea className="border-red-300" value={imageRights.rightsNote} onChange={(e) => setImageRights((v) => ({ ...v, rightsNote: e.target.value }))} /><p className="text-xs text-red-700">تنبيه حقوق: سيظهر مصدر الصورة وملاحظة الحقوق للمستخدمين قبل اعتمادها.</p><Button type="submit" className="bg-[#b86f3c]">إضافة الصورة للمراجعة</Button></form>{details.data?.images?.map((image) => <div key={image.id} className="mt-2 flex justify-between border border-[#e1d5c4] p-2 text-xs"><span>{image.sourceKind} · {image.reviewStatus} · {image.ownerName || image.photographerName || "المصدر غير محدد"}</span><a className="text-[#176b82] underline" href={image.sourceUrl || image.imageUrl} target="_blank" rel="noreferrer">فتح المصدر</a><div className="flex gap-1"><Button type="button" size="sm" className="bg-[#123c52]" onClick={() => reviewImage.mutate({ id: image.id, reviewStatus: "approved", rightsNote: image.rightsNote })}>اعتماد</Button><Button type="button" size="sm" variant="outline" onClick={() => reviewImage.mutate({ id: image.id, reviewStatus: "rejected", rightsNote: "مرفوضة حتى استكمال إثبات الملكية أو الترخيص." })}>رفض</Button><Button type="button" size="sm" variant="destructive" onClick={() => archiveImage.mutate({ id: image.id, reason: "أرشفة من فريق التوثيق" })}>أرشفة</Button></div></div>)}</section>}{duplicateQuery.data?.length ? <div className="mt-5 border-t border-[#d7c9b5] pt-5"><h3 className="font-bold">حل التكرارات المحتملة</h3>{duplicateQuery.data.map((candidate) => <div key={candidate.id} className="mt-2 flex items-center justify-between border border-[#e1d5c4] p-2 text-xs"><span>{candidate.name} · #{candidate.id}</span><div className="flex gap-1"><Button type="button" size="sm" className="bg-[#123c52]" onClick={() => selectedId && mergeDuplicate.mutate({ primaryId: selectedId, duplicateId: candidate.id })}>دمج هنا</Button><Button type="button" size="sm" variant="destructive" onClick={() => archivePoint.mutate({ id: candidate.id, reason: `تكرار محتمل للنقطة ${form.name}` })}>أرشفة</Button></div></div>)}</div> : null}</section>
      <section className="border border-[#d7c9b5] bg-white/70 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">قائمة المراجعة</h2><p className="mt-1 text-sm text-slate-600">لا تظهر النقطة للعامة إلا بعد اعتمادها ونشرها.</p></div><select className="border border-[#d7c9b5] bg-white p-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="mt-4 space-y-3">{queue.isLoading ? <p>جارٍ تحميل السجلات…</p> : rows.length === 0 ? <p className="border border-dashed border-[#d7c9b5] p-6 text-center text-slate-500">لا توجد نقاط في هذه الحالة.</p> : rows.map((row) => <article key={row.id} className="border border-[#e1d5c4] bg-[#fffdf8] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{row.name}</h3><p className="text-xs text-slate-500">{row.layerId} · {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}</p></div><span className="bg-[#edf3f4] px-2 py-1 text-xs">{statusLabels[row.recordStatus]}</span></div><p className="mt-2 line-clamp-2 text-sm text-slate-600">{row.description || "لا يوجد وصف بعد."}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setSelectedId(row.id); setForm({ layerId: row.layerId, name: row.name, description: row.description || "", latitude: String(row.latitude), longitude: String(row.longitude), municipality: row.municipality || "", category: row.category || "", source: row.source || "", sourceKind: row.sourceKind }); }}>تعديل</Button><Button size="sm" className="bg-[#123c52]" onClick={() => reviewPoint.mutate({ id: row.id, recordStatus: "published", reviewNote: "تمت المراجعة والنشر من فريق التوثيق." })}>اعتماد ونشر</Button><Button size="sm" variant="destructive" onClick={() => reviewPoint.mutate({ id: row.id, recordStatus: "rejected", reviewNote: "تحتاج مراجعة إضافية." })}>إرجاع للمراجعة</Button></div></article>)}</div></section>
    </div>
  </main>;
}
