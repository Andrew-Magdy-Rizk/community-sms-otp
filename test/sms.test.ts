import assert from "node:assert/strict";
import test from "node:test";
import { checkQuota, describeStatus, normalizeEgyptianPhone } from "../src/sms.js";

test("normalizes a local Egyptian mobile number", () => {
  assert.equal(normalizeEgyptianPhone("010 1234 5678"), "201012345678");
});

test("keeps an international Egyptian mobile number", () => {
  assert.equal(normalizeEgyptianPhone("+20 11 2345 6789"), "201123456789");
});

test("rejects unsupported phone numbers", () => {
  assert.equal(normalizeEgyptianPhone("01912345678"), null);
});

test("describes documented provider codes", () => {
  assert.match(describeStatus(0), /تم قبول طلب الرسالة/);
  assert.match(describeStatus(-2), /IP whitelist/);
  assert.match(describeStatus(-5), /رصيد/);
});

test("reports a finite Community SMS quota", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response("42", { status: 200 });

  const quota = await checkQuota({
    username: "username",
    password: "password",
    sender: "sender",
  });

  assert.deepEqual(quota, { ok: true, unlimited: false, remaining: 42 });
});

test("reports an unlimited Community SMS quota", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response("0", { status: 200 });

  const quota = await checkQuota({
    username: "username",
    password: "password",
    sender: "sender",
  });

  assert.deepEqual(quota, { ok: true, unlimited: true, remaining: null });
});
