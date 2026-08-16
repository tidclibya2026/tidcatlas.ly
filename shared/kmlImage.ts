export function extractKmlImageUrls(description: string, properties: Record<string, string> = {}) {
  const decodedDescription = decodeKmlHtml(description);
  const propertyEntries = Object.entries(properties).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value] as const);
  const propertyMap = new Map(propertyEntries);
<<<<<<< HEAD
  const fromProperties = ["imageurl", "image", "imagehref", "photourl", "photo", "pictureurl", "picture", "thumbnailurl", "mediaurl"]
    .map((key) => propertyMap.get(key)).filter(Boolean).map((value) => decodeKmlUrl(value!));
=======
  const fromProperties = ["imageurl", "image", "imagehref", "photourl", "photo", "pictureurl", "picture", "thumbnailurl", "mediaurl", "medialinks", "gxmedialinks", "imageurls"]
    .flatMap((key) => {
      const value = propertyMap.get(key);
      if (!value) return [];
      const urls = Array.from(value.matchAll(/https?:\/\/[^\s"'<>\]]+/gi), (match) => decodeKmlUrl(match[0]));
      return urls.length ? urls : [decodeKmlUrl(value)];
    });
>>>>>>> origin/repair/latest-atlas-2026

  const candidates = [
    ...fromProperties,
    ...Array.from(decodedDescription.matchAll(/<(?:img|image)[^>]+(?:src|href)=["']([^"']+)["']/gi), (match) => match[1]),
    ...Array.from(decodedDescription.matchAll(/https?:\/\/[^\s"'<>]+/gi), (match) => match[0]),
  ].map((value) => decodeKmlUrl(value).replace(/[),.;]+$/, "")).filter((value) => /^https?:\/\//i.test(value));
  return Array.from(new Set(candidates));
}

export function extractKmlImageUrl(description: string, properties: Record<string, string> = {}) {
  return extractKmlImageUrls(description, properties)[0];
}

function decodeKmlHtml(value: string) {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function decodeKmlUrl(value: string) {
<<<<<<< HEAD
  return value.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").trim();
=======
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/\\u0026/g, "&").trim();
>>>>>>> origin/repair/latest-atlas-2026
}

export function normalizeKmlImageRights(properties: Record<string, string>) {
  const entries = Object.entries(properties).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value.trim()] as const);
  const find = (keys: string[]) => entries.find(([key, value]) => keys.includes(key) && value)?.[1];
  return {
    author: find(["author", "creator", "photographer", "imageauthor", "photoauthor"]),
    license: find(["license", "licence", "imagelicense", "photolicense"]),
    note: find(["licensenote", "imagelicensenote", "photolicensenote"]),
  };
}

export function toDisplayImageUrl(sourceUrl?: string) {
  if (!sourceUrl) return undefined;
  if (!/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return `https://images.weserv.nl/?url=${encodeURIComponent(sourceUrl)}&w=1200&q=82&output=webp`;
}

export function toFallbackImageUrl(sourceUrl?: string) {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return undefined;
  return `https://wsrv.nl/?url=${encodeURIComponent(sourceUrl)}&w=1200&q=82&output=webp`;
}
