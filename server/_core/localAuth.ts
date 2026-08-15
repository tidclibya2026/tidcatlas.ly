import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { sdk } from "./sdk";

const scrypt = promisify(scryptCallback);
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const bootstrapSchema = loginSchema.extend({ name: z.string().min(2).max(160) });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded?.startsWith("scrypt:")) return false;
  const [, salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function setSession(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ONE_YEAR_MS });
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await db.getUserByEmail(email);
      if (!user?.isActive || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
        return;
      }
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const token = await sdk.signSession({ openId: user.openId, appId: "standalone", name: user.name ?? user.email ?? "" });
      setSession(res, token);
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "تعذر تسجيل الدخول" });
    }
  });

  app.post("/api/auth/local/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.status(204).end();
  });

  app.post("/api/auth/local/bootstrap", async (req, res) => {
    try {
      const { email, password, name } = bootstrapSchema.parse(req.body);
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "يوجد مستخدم بهذا البريد" });
        return;
      }
      const admin = await db.createLocalUser({ email, name, passwordHash: await hashPassword(password), role: "admin" });
      if (!admin) throw new Error("تعذر إنشاء المسؤول");
      res.status(201).json({ id: admin.id, email: admin.email, role: admin.role });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "تعذر إنشاء المسؤول" });
    }
  });
}
