// أسماء النقاط الحالية ذات المطابقة المؤكدة في top-150-match-report.md.
// لا تُضاف أسماء غير محسومة حتى لا تُنشأ مفضلة من بيانات غير موثقة.
export const FAVORITE_SITE_NAMES = [
  "مدينة لبدة الاثرية الكبرى", "اثار صبراتة", "موقع شحات (قورينة) الأثري", "غدامس", "جبال أكاكوس",
  "المدينة القديمة غات", "شلال بالفو", "عين الفرس", "كهف هوا فطيح", "متحف غدامس",
] as const;

export function normalizeFavoriteName(value: string) {
  return value.toLocaleLowerCase().replace(/[\u200e\u200f\u00a0]/g, "").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[^\u0600-\u06ff\w]/g, "");
}

const favoriteKeys = new Set(FAVORITE_SITE_NAMES.map(normalizeFavoriteName));

export function isFavoriteSiteName(name: string) {
  return favoriteKeys.has(normalizeFavoriteName(name));
}
