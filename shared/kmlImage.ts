export function extractKmlImageUrl(description: string, properties: Record<string, string> = {}) {
  const decodedDescription = decodeKmlHtml(description);
  const propertyEntries = Object.entries(properties).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value] as const);
  const propertyMap = new Map(propertyEntries);
  const fromProperties = ["imageurl", "image", "imagehref", "photourl", "photo", "pictureurl", "picture", "thumbnailurl", "mediaurl"].map((key) => propertyMap.get(key)).find(Boolean);
  const decodedProperty = fromProperties ? decodeKmlUrl(fromProperties) : undefined;
  if (decodedProperty?.startsWith("http")) return decodedProperty;

  const imageTag = decodedDescription.match(/<(?:img|image)[^>]+(?:src|href)=["']([^"']+)["']/i);
  const plainUrl = decodedDescription.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  const candidate = imageTag?.[1] || plainUrl;
  return candidate ? decodeKmlUrl(candidate) : undefined;
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
  return value.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").trim();
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
