import { randomInt, randomUUID } from "node:crypto";

const SEND_SMS_URL =
  "https://app.community-ads.net/SendSMSAPI/api/SMSSender/SendSMSWithDLR";
const CHECK_CREDIT_URL =
  "https://app.community-ads.net/SendSMSAPI/api/SMSSender/CheckCredit";

export type SmsCredentials = Readonly<{
  username: string;
  password: string;
  sender: string;
}>;

export type SendOtpResult =
  | Readonly<{ ok: true; code: 0; smsId: string; message: string }>
  | Readonly<{ ok: false; code: number; smsId: string; message: string }>;

export type QuotaResult =
  | Readonly<{ ok: true; unlimited: true; remaining: null }>
  | Readonly<{ ok: true; unlimited: false; remaining: number }>
  | Readonly<{ ok: false; code: number; message: string }>;

const statusMessages = {
  0: "تم قبول طلب الرسالة لدى Community. هذا لا يضمن وصولها؛ راجع حالة التسليم مع المزود إذا لم تصل.",
  [-1]: "بيانات الدخول غير صحيحة.",
  [-2]: "عنوان IP الحالي غير موجود في IP whitelist للحساب.",
  [-3]: "رقم الهاتف موجود في blacklist الخاصة بالحساب.",
  [-5]: "رصيد الرسائل انتهى.",
  [-6]: "قاعدة بيانات مزود الخدمة غير متاحة حاليًا.",
  [-7]: "الحساب غير نشط.",
  [-11]: "صلاحية الحساب انتهت.",
  [-12]: "نص الرسالة فارغ.",
  [-13]: "مشكلة في اتصال Sender.",
  [-14]: "فشل إرسال الرسالة، حاول مرة أخرى.",
  [-18]: "رقم الهاتف غير صحيح.",
  [-19]: "SMS ID مستخدم من قبل.",
  [-21]: "الحساب غير موجود.",
  [-23]: "اتصال الـ operator غير صحيح.",
  [-26]: "SMS ID ليس GUID صحيحًا.",
  [-29]: "اسم المستخدم أو كلمة المرور فارغان.",
  [-30]: "اسم Sender غير صحيح.",
  [-100]: "خطأ داخلي لدى مزود الخدمة.",
} satisfies Readonly<Record<number, string>>;

export function describeStatus(code: number): string {
  if (code === -16) {
    return "The Community account is not permitted to send SMS messages with DLR.";
  }

  return (
    statusMessages[code as keyof typeof statusMessages] ??
    `أعاد مزود الخدمة كودًا غير معروف: ${code}`
  );
}

export function normalizeEgyptianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  if (/^01[0125]\d{8}$/.test(digits)) {
    return `2${digits}`;
  }

  if (/^201[0125]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

function parseProviderCode(body: string): number | null {
  const parsed = Number(body.trim().replace(/^"|"$/g, ""));
  return Number.isInteger(parsed) ? parsed : null;
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 5)}****${phone.slice(-3)}`;
}

export async function checkQuota(
  credentials: SmsCredentials,
): Promise<QuotaResult> {
  const quotaUrl = new URL(CHECK_CREDIT_URL);
  quotaUrl.searchParams.set("userName", credentials.username);
  quotaUrl.searchParams.set("password", credentials.password);

  let response: Response;
  try {
    response = await fetch(quotaUrl, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error: unknown) {
    console.error("[Community SMS] Quota request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const responseBody = await response.text();
  const code = parseProviderCode(responseBody);
  console.info("[Community SMS] Quota response", {
    httpStatus: response.status,
    httpStatusText: response.statusText,
    providerCode: code,
    responseBody,
  });

  if (!response.ok || code === null) {
    return {
      ok: false,
      code: response.ok ? -100 : response.status,
      message: response.ok
        ? "Community returned an invalid quota response."
        : `Community quota request failed over HTTP (${response.status}).`,
    };
  }

  if (code < 0) {
    return { ok: false, code, message: describeStatus(code) };
  }

  if (code === 0) {
    return { ok: true, unlimited: true, remaining: null };
  }

  return { ok: true, unlimited: false, remaining: code };
}

export async function sendOtp(
  receiver: string,
  credentials: SmsCredentials,
  dlrUrl: string,
): Promise<SendOtpResult> {
  const otp = generateOtp();
  const smsId = randomUUID();
  const payload = {
    UserName: credentials.username,
    Password: credentials.password,
    SMSText: `Your verification is ${otp}. Do not share it with anyone.`,
    SMSLang: "E",
    SMSSender: credentials.sender,
    SMSReceiver: receiver,
    SMSID: smsId,
    DLRURL: dlrUrl,
  } satisfies Readonly<Record<string, string>>;

  console.info("[Community SMS] Sending request", {
    smsId,
    receiver: maskPhone(receiver),
    sender: credentials.sender,
    deliveryReports: true,
  });

  let response: Response;
  try {
    response = await fetch(SEND_SMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error: unknown) {
    console.error("[Community SMS] API request failed", {
      smsId,
      receiver: maskPhone(receiver),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const responseBody = await response.text();
  const code = parseProviderCode(responseBody);

  // Do not log the request body: it includes the account password and OTP.
  // The provider response, SMS ID, and masked recipient are enough to diagnose delivery.
  console.info("[Community SMS] API response", {
    smsId,
    receiver: maskPhone(receiver),
    httpStatus: response.status,
    httpStatusText: response.statusText,
    providerCode: code,
    responseBody,
  });

  if (!response.ok) {
    return {
      ok: false,
      code: response.status,
      smsId,
      message: `فشل اتصال الـ API عبر HTTP (${response.status}).`,
    };
  }

  if (code === null) {
    return {
      ok: false,
      code: -100,
      smsId,
      message: "استجابة الـ API ليست رقمًا كما هو موضح في المستند.",
    };
  }

  if (code === 0) {
    return { ok: true, code, smsId, message: describeStatus(code) };
  }

  return { ok: false, code, smsId, message: describeStatus(code) };
}
