import { describe, expect, it } from "vitest";
import { isGitHubPagesHost } from "./const";

describe("OAuth host guard", () => {
  it("recognizes GitHub Pages hosts", () => {
    expect(isGitHubPagesHost("tidclibya2026.github.io")).toBe(true);
    expect(isGitHubPagesHost("admin.example.org")).toBe(false);
  });
});
