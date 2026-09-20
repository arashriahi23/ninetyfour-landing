import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

function setup(fetchResponse, protocol = "https:") {
  const attributes = new Map();
  const input = { value: "test@example.invalid", setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key), focus() {}, addEventListener() {} };
  const button = { disabled: false, textContent: "Subscribe" };
  const status = { textContent: "", dataset: {} };
  const calls = [];
  let submit;
  let resets = 0;
  const form = {
    addEventListener(type, handler) { if (type === "submit") submit = handler; },
    querySelector: selector => selector.startsWith("button") ? button : input,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    reset() { resets++; input.value = ""; }
  };
  const elements = {
    ".masthead": { offsetHeight: 64 },
    ".mobile-menu": { open: false },
    "[data-newsletter-form]": form,
    "[data-newsletter-status]": status
  };
  runInNewContext(source, {
    document: { querySelector: selector => elements[selector], querySelectorAll: () => [], addEventListener() {} },
    window: { innerHeight: 844, location: { search: "", protocol }, addEventListener() {} },
    URLSearchParams, TypeError,
    FormData: class { get() { return input.value; } },
    fetch: async (...args) => { calls.push(args); return fetchResponse(...args); }
  });
  return { input, button, status, attributes, calls, get resets() { return resets; }, submit: () => submit({ preventDefault() {} }) };
}

test("invalid email never reaches the subscription endpoint", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); });
  page.input.value = "invalid";
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.attributes.get("aria-invalid"), "true");
  assert.match(page.status.textContent, /valid email/);
});

test("accepted signup preserves the API contract and requests confirmation", async () => {
  const page = setup(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  page.input.value = " test@example.invalid ";
  await page.submit();
  assert.equal(page.calls[0][0], "/api/subscribe");
  assert.equal(page.calls[0][1].method, "POST");
  assert.equal(page.calls[0][1].body, JSON.stringify({ email: "test@example.invalid" }));
  assert.equal(page.resets, 1);
  assert.match(page.status.textContent, /Check your inbox to confirm/);
  assert.equal(page.button.disabled, false);
  assert.equal(page.attributes.has("aria-busy"), false);
});

test("configuration and malformed responses cannot show success or erase email", async () => {
  for (const response of [
    { ok: false, json: async () => ({ error: "Newsletter service is not configured." }) },
    { ok: true, json: async () => { throw new SyntaxError("HTML response"); } },
    { ok: true, json: async () => ({}) }
  ]) {
    const page = setup(async () => response);
    await page.submit();
    assert.equal(page.status.dataset.state, "error");
    assert.equal(page.resets, 0);
    assert.equal(page.input.value, "test@example.invalid");
    assert.equal(page.button.disabled, false);
  }
});

test("network failure permits a retry", async () => {
  let attempts = 0;
  const page = setup(async () => {
    if (!attempts++) throw new TypeError("Network failure");
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await page.submit();
  assert.equal(page.status.dataset.state, "error");
  assert.match(page.status.textContent, /Unable to connect/);
  await page.submit();
  assert.equal(page.status.dataset.state, "success");
});

test("pending signup blocks duplicate submissions", async () => {
  let finish;
  const page = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = page.submit();
  await page.submit();
  assert.equal(page.calls.length, 1);
  assert.equal(page.button.disabled, true);
  assert.equal(page.attributes.get("aria-busy"), "true");
  finish({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(page.button.disabled, false);
});

test("opening the file directly does not attempt a subscription", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); }, "file:");
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.status.dataset.state, "error");
  assert.match(page.status.textContent, /hosted website/);
});
