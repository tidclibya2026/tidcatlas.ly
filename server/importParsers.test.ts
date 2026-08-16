import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel, parseKml } from "./importParsers";

describe("atlas import parsers", () => {
  it("parses KML names, coordinates and metadata", () => {
    const kml = `<kml><Document><Placemark><name>مسرح لبدة</name><description><![CDATA[<p>موقع تاريخي</p>]]></description><ExtendedData><Data name="municipality"><value>الخمس</value></Data></ExtendedData><Point><coordinates>14.29,32.64,0</coordinates></Point></Placemark></Document></kml>`;
    const result = parseKml(Buffer.from(kml), { layerId: "heritage" });
    expect(result.totalRows).toBe(1);
    expect(result.rows[0]).toMatchObject({ name: "مسرح لبدة", latitude: 32.64, longitude: 14.29, layerId: "heritage", municipality: "الخمس" });
    expect(result.rows[0]?.fingerprint).toHaveLength(40);
  });

  it("reports invalid KML placemarks instead of inserting them", () => {
    const result = parseKml(Buffer.from(`<kml><Placemark><name>بدون إحداثيات</name></Placemark></kml>`));
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.message).toContain("إحداثيات");
  });

  it("numbers multiple import issues sequentially from one", () => {
    const result = parseKml(Buffer.from(`<kml><Placemark><name>بدون إحداثيات 1</name></Placemark><Placemark><name>بدون إحداثيات 2</name></Placemark><Placemark><name>صالح</name><Point><coordinates>14.2,25.1,0</coordinates></Point></Placemark><Placemark><name>بدون إحداثيات 3</name></Placemark></kml>`));
    expect(result.issues.map((issue) => issue.issueNumber)).toEqual([1, 2, 3]);
    expect(result.issues.map((issue) => issue.rowNumber)).toEqual([1, 2, 4]);
  });

  it("maps Arabic and English XLSX headers", () => {
    const sheet = XLSX.utils.json_to_sheet([{ الاسم: "واحة", "خط العرض": 25.1, "خط الطول": 14.2, البلدية: "مرزق" }]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Sites");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = parseExcel(buffer, { layerId: "natural" });
    expect(result.rows[0]).toMatchObject({ name: "واحة", latitude: 25.1, longitude: 14.2, municipality: "مرزق", sourceKind: "excel" });
  });
});
