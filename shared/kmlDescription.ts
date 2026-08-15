export function descriptionSourceText(textContent?: string | null, innerHtml?: string | null): string {
  return [textContent, innerHtml].filter(Boolean).join(" ");
}

export function cleanKmlDescription(raw: string, maxLength = 1200): string {
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function hasRawKmlCoordinates(text: string): boolean {
  return /(?:^|\s)coordinates\s*[:=]/i.test(text) || /-?\d{1,3}\.\d{3,},-?\d{1,3}\.\d{3,}/.test(text);
}

export function cleanUserFacingKmlDescription(raw: string): string {
  const cleaned = cleanKmlDescription(raw);
  return hasRawKmlCoordinates(cleaned) ? "" : cleaned;
}
