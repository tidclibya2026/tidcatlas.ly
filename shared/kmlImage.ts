export function extractKmlImageUrl(description: string, properties: Record<string, string> = {}) {
  const decodedDescription = decodeKmlHtml(description);
  const fromProperties = properties.image_url || properties.imageUrl || properties.photo_URL || properties.photoUrl || properties.photo;
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
