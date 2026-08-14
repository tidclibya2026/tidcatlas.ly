export const FAVORITE_IMAGE = {
  url: "/manus-storage/waw-an-namus-wikimedia_5cabbb3f.jpg",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Wau-en-Namus-2.jpg",
  author: "Rolfcosar",
  license: "CC BY-SA 3.0",
} as const;

export function favoriteImageMetadata(hasKmlImage: boolean, properties: Record<string, string>) {
  if (hasKmlImage) {
    return {
      image_source: properties.image_source || "مصدر الصورة من ملف KML",
      image_author: properties.image_author || "موجود في بيانات KML",
      image_license: properties.image_license || "يرجى مراجعة ترخيص KML",
      image_license_note: "صورة مرتبطة ببيانات KML",
    };
  }
  return {
    image_source: FAVORITE_IMAGE.sourceUrl,
    image_author: FAVORITE_IMAGE.author,
    image_license: FAVORITE_IMAGE.license,
    image_license_note: "صورة بيئية عامة للعرض المؤقت وليست صورة موضعية مؤكدة؛ تعتمد وفق شروط CC BY-SA 3.0.",
  };
}
