import assert from "node:assert/strict";
import test from "node:test";
import { describeStatus, normalizeEgyptianPhone } from "../src/sms.js";

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
