export type SiteImageFallback = {
  image_source: string;
  image_author: string;
  image_license: string;
  image_license_note: string;
};

const FORUM_LEPTIS_MAGNA_IMAGE: SiteImageFallback = {
  image_source: "https://upload.wikimedia.org/wikipedia/commons/9/92/Forum_Leptis_Magna_03.JPG",
  image_author: "SashaCoachman",
  image_license: "CC BY-SA 3.0",
  image_license_note: "الصورة من Wikimedia Commons؛ يجب ذكر المؤلف ورابط المصدر والترخيص.",
};

const AL_HAYAT_TOWER_IMAGE: SiteImageFallback = {
  image_source: "/manus-storage/al-hayat-tower-wikimedia_dee826ba.jpg",
  image_author: "Abdul-Jawad Elhusuni (عبدالجواد الحسوني)",
  image_license: "CC BY-SA 3.0",
  image_license_note: "صورة JW Marriott / برج الحياة من Wikimedia Commons؛ المصدر: https://en.wikipedia.org/wiki/File:JW_Marriott_Tripoli_Libya.JPG — يجب ذكر المؤلف والترخيص.",
};

const NORMALIZED_SIFIRIYA_NAMES = new Set([
  "الساحة السيفيرية",
  "الفوروم السيفيري",
  "الساحة السيفيرية لبدة الكبرى",
  "forum of severus",
  "severan forum",
  "severan square",
]);

function normalizeSiteName(name: string) {
  return name
    .toLocaleLowerCase("ar")
    .replace(/[\u200f\u200e\u0640]/g, "")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[()،,:;_'"-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifiedSiteImageFallback(name: string): SiteImageFallback | undefined {
  const normalized = normalizeSiteName(name);
  if (NORMALIZED_SIFIRIYA_NAMES.has(normalized) || normalized.includes("الساحة السيفيرية") || normalized.includes("forum of severus") || normalized.includes("severan forum")) {
    return { ...FORUM_LEPTIS_MAGNA_IMAGE };
  }
  if (normalized.includes("برج الحياة") || normalized.includes("ماريوت") || normalized.includes("marriott") || normalized.includes("al hayat") || normalized.includes("lancaster burj al hayat")) {
    return { ...AL_HAYAT_TOWER_IMAGE };
  }
  return undefined;
}
