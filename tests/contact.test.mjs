import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

function setup(fetchResponse, { valid = true, protocol = "https:" } = {}) {
  const attributes = new Map();
  const values = new Map([
    ["name", "Arash Riahi"],
    ["email", "hello@example.com"],
    ["message", "I would like to learn more."],
    ["website", ""]
  ]);
  const startedAt = { value: "" };
  const emailInput = {
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    focus() {},
    addEventListener() {}
  };
  const button = { disabled: false, textContent: "Send message" };
  const status = { textContent: "", dataset: {} };
  const calls = [];
  let submit;
  let resets = 0;
  let validityReports = 0;
  const form = {
    addEventListener(type, handler) { if (type === "submit") submit = handler; },
    checkValidity: () => valid,
    reportValidity() { validityReports++; },
    querySelector(selector) {
      if (selector === "input[name='startedAt']") return startedAt;
      if (selector === "input[name='email']") return emailInput;
      return button;
    },
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    reset() { resets++; }
  };
  const elements = {
    ".masthead": { offsetHeight: 64, dataset: {} },
    ".mobile-menu": { open: false, contains: () => false, querySelector: () => ({ focus() {} }) },
    "[data-contact-form]": form,
    "[data-contact-form-status]": status
  };
  runInNewContext(source, {
    document: { querySelector: selector => elements[selector], querySelectorAll: () => [], addEventListener() {} },
    window: { innerHeight: 844, innerWidth: 390, location: { search: "", protocol }, addEventListener() {} },
    requestAnimationFrame: callback => callback(),
    URLSearchParams, TypeError, Date, JSON,
    FormData: class {
      get(key) { return key === "startedAt" ? startedAt.value : values.get(key); }
    },
    fetch: async (...args) => { calls.push(args); return fetchResponse(...args); }
  });
  return {
    values, button, status, attributes, calls,
    get resets() { return resets; },
    get validityReports() { return validityReports; },
    submit: () => submit({ preventDefault() {} })
  };
}

test("contact form posts required fields to the Worker and shows success", async () => {
  const page = setup(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  await page.submit();
  assert.equal(page.calls[0][0], "/api/contact");
  assert.equal(page.calls[0][1].method, "POST");
  const payload = JSON.parse(page.calls[0][1].body);
  assert.deepEqual(
    { name: payload.name, email: payload.email, message: payload.message, website: payload.website },
    { name: "Arash Riahi", email: "hello@example.com", message: "I would like to learn more.", website: "" }
  );
  assert.equal(typeof payload.startedAt, "number");
  assert.equal(page.resets, 1);
  assert.equal(page.status.textContent, "MESSAGE RECEIVED");
  assert.equal(page.status.dataset.state, "success");
  assert.equal(page.button.disabled, false);
});

test("invalid contact email never reaches the endpoint", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); });
  page.values.set("email", "invalid");
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.attributes.get("aria-invalid"), "true");
  assert.equal(page.status.textContent, "ENTER A VALID EMAIL ADDRESS.");
});

test("contact form reports native validation failures", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); }, { valid: false });
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.validityReports, 1);
});

test("contact network failure permits a retry and blocks duplicate submissions", async () => {
  let finish;
  const page = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = page.submit();
  await page.submit();
  assert.equal(page.calls.length, 1);
  assert.equal(page.button.disabled, true);
  finish({ ok: false, json: async () => ({ error: "Unable to send." }) });
  await pending;
  assert.equal(page.status.dataset.state, "error");
  assert.equal(page.status.textContent, "SOMETHING WENT WRONG. PLEASE TRY AGAIN.");
  assert.equal(page.button.disabled, false);
});

test("local file preview does not attempt contact submission", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); }, { protocol: "file:" });
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.status.dataset.state, "error");
  assert.equal(page.status.textContent, "SOMETHING WENT WRONG. PLEASE TRY AGAIN.");
});
