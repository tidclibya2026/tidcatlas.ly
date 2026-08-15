import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("import status integration contract", () => {
  const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("normalizes KML records before returning parsed sites", () => {
    expect(home).toContain('const normalizedProperties = normalizeRecordStatus(properties);');
    expect(home).toContain('properties: normalizedProperties, layerId }');
  });

  it("normalizes GeoJSON records before returning parsed sites", () => {
    expect(home).toContain('const normalizedProperties = normalizeRecordStatus(properties);');
    expect(home).toContain('properties: normalizedProperties, layerId: config.id }');
  });
});
