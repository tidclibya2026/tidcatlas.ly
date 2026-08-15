import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/localAuth";

describe("standalone local authentication", () => {
  it("hashes and verifies a password without storing the clear text", async () => {
    const password = "LibyaAtlas!2026";
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt:/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
  });

  it("rejects malformed or missing hashes", async () => {
    await expect(verifyPassword("password", null)).resolves.toBe(false);
    await expect(verifyPassword("password", "plain-text")).resolves.toBe(false);
  });
});
