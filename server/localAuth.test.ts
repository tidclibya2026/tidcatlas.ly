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


  it("creates a new one-way hash when a password is reset", async () => {
    const first = await hashPassword("OldAtlas!2026");
    const next = await hashPassword("NewAtlas!2026");
    expect(next).not.toBe(first);
    await expect(verifyPassword("NewAtlas!2026", next)).resolves.toBe(true);
    await expect(verifyPassword("OldAtlas!2026", next)).resolves.toBe(false);
  });
