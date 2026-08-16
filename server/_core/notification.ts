import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };
const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!title || !content) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title and content are required." });
  if (title.length > TITLE_MAX_LENGTH || content.length > CONTENT_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification payload is too large." });
  return { title, content };
};

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const normalized = validatePayload(payload);
  if (ENV.notificationWebhookUrl) {
    try {
      const response = await fetch(ENV.notificationWebhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(normalized) });
      if (response.ok) return true;
      console.warn(`[Notification] webhook failed: ${response.status}`);
    } catch (error) {
      console.warn("[Notification] webhook error", error);
    }
  }

  const logDir = path.resolve(ENV.storageDir, "..", "notifications");
  await mkdir(logDir, { recursive: true });
  await appendFile(path.join(logDir, "notifications.jsonl"), `${JSON.stringify({ ...normalized, createdAt: new Date().toISOString() })}\n`, "utf8");
  return true;
}
