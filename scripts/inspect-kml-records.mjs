import fs from "node:fs";
import { XMLParser } from "fast-xml-parser";

const file = "client/public/data/world-heritage_ae1639b4.kml";
const xml = fs.readFileSync(file, "utf8");
const parser = new XMLParser({ ignoreAttributes: false, trimValues: false });
const root = parser.parse(xml);
const placemarks = [];
function walk(value) {
  if (!value || typeof value !== "object") return;
  if (value.Placemark) {
    const items = Array.isArray(value.Placemark) ? value.Placemark : [value.Placemark];
    placemarks.push(...items);
  }
  for (const child of Object.values(value)) walk(child);
}
walk(root);
for (const placemark of placemarks) {
  const coords = String(placemark.Point?.coordinates ?? "").trim();
  if (coords.includes("14.3094895,32.6323093") || coords.includes("14.2904233,32.638338")) {
    console.log(JSON.stringify({ name: placemark.name, description: placemark.description, extendedData: placemark.ExtendedData, coords }, null, 2));
  }
}
