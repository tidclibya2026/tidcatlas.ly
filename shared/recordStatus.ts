export type RecordStatus = "موقع موثق" | "مسودة" | "مراجعة مطلوبة";

const STATUS_KEYS = ["record_status", "status", "state", "publication_status", "حالة السجل"];
const DRAFT_KEYS = ["draft", "is_draft", "مسودة"];

export function normalizeRecordStatus(properties: Record<string, string>): Record<string, string> {
  const next = { ...properties };
  const rawStatus = STATUS_KEYS.map(key => next[key]).find(value => typeof value === "string" && value.trim());
  const rawDraft = DRAFT_KEYS.map(key => next[key]).find(value => typeof value === "string" && value.trim());
  const draft = /^(true|1|yes|نعم|مسودة)$/i.test(String(rawDraft || ""));
  const normalized: RecordStatus = draft ? "مسودة" : rawStatus?.trim() === "مسودة" ? "مسودة" : (rawStatus?.trim() ? "مراجعة مطلوبة" : "مراجعة مطلوبة");
  next.record_status = normalized;
  next.draft = draft ? "true" : "false";
  return next;
}
