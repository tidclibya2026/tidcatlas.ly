import fs from 'node:fs';
const path = 'client/src/pages/SystemAdmin.tsx';
let text = fs.readFileSync(path, 'utf8');
const marker = '  const suggestionQueue = trpc.atlas.suggestionQueue.useQuery({ status: "pending" }, { enabled: isAdmin });';
const hooks = `${marker}
  const sourceReconciliation = trpc.atlas.sourceReconciliation.useQuery(undefined, { enabled: isAdmin });
  const pendingRecords = trpc.atlas.reviewQueue.useQuery({ recordStatus: "pending_review", sort: "newest" }, { enabled: isAdmin });
  const [duplicateForm, setDuplicateForm] = useState({ name: "", latitude: "", longitude: "" });
  const [duplicateSearch, setDuplicateSearch] = useState({ name: "", latitude: 0, longitude: 0 });
  const duplicateCandidates = trpc.atlas.findDuplicates.useQuery(duplicateSearch, { enabled: isAdmin && Boolean(duplicateSearch.name) && duplicateSearch.latitude !== 0 && duplicateSearch.longitude !== 0 });
  const [duplicatePrimaryId, setDuplicatePrimaryId] = useState<number | null>(null);
  const reviewPending = trpc.atlas.review.useMutation({ onSuccess: () => { toast.success("تم تحديث حالة السجل"); pendingRecords.refetch(); }, onError: (error) => toast.error(error.message) });
  const mergeDuplicate = trpc.atlas.mergeDuplicate.useMutation({ onSuccess: () => { toast.success("تم دمج السجلين وتسجيل العملية"); duplicateCandidates.refetch(); pendingRecords.refetch(); setDuplicatePrimaryId(null); }, onError: (error) => toast.error(error.message) });
  const runDuplicateSearch = (event: React.FormEvent) => { event.preventDefault(); const latitude = Number(duplicateForm.latitude); const longitude = Number(duplicateForm.longitude); if (!duplicateForm.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return toast.error("أدخل اسم الموقع والإحداثيات بشكل صحيح"); setDuplicateSearch({ name: duplicateForm.name.trim(), latitude, longitude }); setDuplicatePrimaryId(null); };`;
if (!text.includes('const sourceReconciliation')) text = text.replace(marker, hooks);
const insertionMarker = '<section className="mt-6 border-t border-[#d7c9b5] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">مراجعة الصور وربطها بالنقاط</h2>';
const panel = fs.readFileSync('scripts/admin-reconciliation-panel.txt', 'utf8');
if (!text.includes('تقرير مطابقة المصادر')) text = text.replace(insertionMarker, panel + insertionMarker);
fs.writeFileSync(path, text);
