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
  return undefined;
}
