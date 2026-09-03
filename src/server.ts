import "dotenv/config";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeEgyptianPhone,
  sendOtp,
  type SmsCredentials
} from "./sms.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(publicDirectory));

function getCredentials(): SmsCredentials | null {
  const username = process.env.COMMUNITY_SMS_USERNAME?.trim();
  const password = process.env.COMMUNITY_SMS_PASSWORD?.trim();
  const sender = process.env.COMMUNITY_SMS_SENDER?.trim();

  return username && password && sender ? { username, password, sender } : null;
}

function getDlrUrl(): string | null {
  const value = process.env.COMMUNITY_SMS_DLR_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getQueryValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

app.get("/api/health", (_request: Request, response: Response): void => {
  response.json({
    ok: true,
    configured: getCredentials() !== null && getDlrUrl() !== null,
    dlrConfigured: getDlrUrl() !== null,
  });
});

app.get("/api/dlr", (request: Request, response: Response): void => {
  const smsId = getQueryValue(request.query.userSMSId);
  const status = getQueryValue(request.query.dlrResponseStatus);

  if (!smsId || !status) {
    console.warn("[Community SMS] Invalid DLR callback", {
      query: request.query,
    });
    response.status(400).send("Missing userSMSId or dlrResponseStatus");
    return;
  }

  console.info("[Community SMS] Delivery report", {
    smsId,
    status,
    receivedAt: new Date().toISOString(),
  });
  response.status(200).send("OK");
});

app.post("/api/send-otp", async (request: Request, response: Response): Promise<void> => {
  const rawPhone =
    typeof request.body === "object" && request.body !== null &&
    "phone" in request.body && typeof request.body.phone === "string"
      ? request.body.phone
      : "";
  const phone = normalizeEgyptianPhone(rawPhone);

  if (!phone) {
    response.status(400).json({
      ok: false,
      message: "اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015."
    });
    return;
  }

  const dlrUrl = getDlrUrl();
  if (!dlrUrl) {
    response.status(500).json({
      ok: false,
      message: "COMMUNITY_SMS_DLR_URL must be a public HTTPS URL.",
    });
    return;
  }

  const credentials = getCredentials();
  if (!credentials) {
    response.status(500).json({
      ok: false,
      message: "بيانات الحساب غير مكتملة في ملف .env."
    });
    return;
  }

  try {
    const result = await sendOtp(phone, credentials, dlrUrl);
    response.status(result.ok ? 200 : 502).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Community SMS request failed:", message);
    response.status(502).json({
      ok: false,
      message: "تعذر الاتصال بخدمة Community SMS. راجع الشبكة أو IP whitelist."
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`OTP tester is running at http://localhost:${port}`);
  });
}

export default app;
