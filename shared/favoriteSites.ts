export const FAVORITE_SITE_NAMES = [
  "موقع لبدة الأثري (لبتس ماغنا) (لبدة الكبرى)", "مدينة لبدة الاثرية الكبرى", "موقع صبراتة الأثري", "اثار صبراتة",
  "موقع شحات (قورينة) الأثري", "مدينة غدامس القديمة", "غدامس", "مواقع تادرارت أكاكوس الصخرية", "جبال أكاكوس", "المدينة القديمة غات",
  "شلال بالفو", "شلال رأس الهلال بافلو", "عين الفرس", "كهف هوا فطيح", "متحف غدامس", "وادي لبدة",
] as const;

export function normalizeFavoriteName(value: string) {
  return value.toLocaleLowerCase().replace(/[\u200e\u200f\u00a0]/g, "").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[^\u0600-\u06ff\w]/g, "");
}

const favoriteKeys = new Set(FAVORITE_SITE_NAMES.map(normalizeFavoriteName));

export function isFavoriteSiteName(name: string) {
  return favoriteKeys.has(normalizeFavoriteName(name));
}
