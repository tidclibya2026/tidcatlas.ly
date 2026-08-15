import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "client/public/data");

function readJson(name: string) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

describe("TIDC attached layer sources", () => {
  it("keeps the media-enriched natural atlas with 945 features", () => {
    const data = readJson("natural-atlas-with-media_5ccb1fb0.geojson");
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(945);
    const mediaFeature = data.features.find((feature: any) => feature.properties?.images || feature.properties?.images_json);
    expect(mediaFeature).toBeTruthy();
    expect(mediaFeature.properties).toHaveProperty("media_status");
  });

  it.each([
    ["hotels_b9547235.kml", "فندق كورنثيا"],
    ["resorts_e4a8f065.kml", "قرية إدوس السياحية"],
    ["world-heritage_ae1639b4.kml", "موقع لبدة الأثري"],
  ])("keeps the supplied KML source %s with the expected site text", (file, expectedText) => {
    const content = fs.readFileSync(path.join(dataDir, file), "utf8");
    expect(content.length).toBeGreaterThan(1000);
    expect(content).toContain(expectedText);
    expect(content).toMatch(/<Placemark\b/i);
  });
});
