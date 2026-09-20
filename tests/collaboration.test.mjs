import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

function setup(fetchResponse, { valid = true, protocol = "https:" } = {}) {
  const attributes = new Map();
  const values = new Map([
    ["name", "Arash Riahi"],
    ["email", "admin@example.com"],
    ["type", "Brand activation"],
    ["date", "2026-10-01"],
    ["location", "Los Angeles"],
    ["guests", "94"],
    ["details", "Coffee and music"],
    ["website", ""]
  ]);
  const startedAt = { value: "" };
  const emailInput = {
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    focus() {},
    addEventListener() {}
  };
  const button = { disabled: false, textContent: "Send inquiry" };
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
    "[data-collaboration-form]": form,
    "[data-collaboration-form-status]": status
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

test("collaboration form posts all fields and shows success", async () => {
  const page = setup(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  await page.submit();
  assert.equal(page.calls[0][0], "/api/collaboration");
  assert.equal(page.calls[0][1].method, "POST");
  const payload = JSON.parse(page.calls[0][1].body);
  assert.deepEqual(
    {
      name: payload.name,
      email: payload.email,
      type: payload.type,
      date: payload.date,
      location: payload.location,
      guests: payload.guests,
      details: payload.details,
      website: payload.website
    },
    {
      name: "Arash Riahi",
      email: "admin@example.com",
      type: "Brand activation",
      date: "2026-10-01",
      location: "Los Angeles",
      guests: "94",
      details: "Coffee and music",
      website: ""
    }
  );
  assert.equal(typeof payload.startedAt, "number");
  assert.equal(page.resets, 1);
  assert.equal(page.status.textContent, "MESSAGE RECEIVED. WE’LL BE IN TOUCH.");
  assert.equal(page.status.dataset.state, "success");
});

test("invalid collaboration fields never reach the endpoint", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); }, { valid: false });
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.validityReports, 1);
});

test("invalid collaboration email never reaches the endpoint", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); });
  page.values.set("email", "invalid");
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.attributes.get("aria-invalid"), "true");
  assert.equal(page.status.textContent, "ENTER A VALID EMAIL ADDRESS.");
});

test("collaboration provider failure keeps the form and allows retry", async () => {
  let finish;
  const page = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = page.submit();
  await page.submit();
  assert.equal(page.calls.length, 1);
  assert.equal(page.button.disabled, true);
  assert.equal(page.button.textContent, "SENDING...");
  finish({ ok: false, json: async () => ({ error: "Unable to send." }) });
  await pending;
  assert.equal(page.resets, 0);
  assert.equal(page.status.textContent, "SOMETHING WENT WRONG. PLEASE TRY AGAIN.");
  assert.equal(page.status.dataset.state, "error");
  assert.equal(page.button.disabled, false);
  assert.equal(page.button.textContent, "Send inquiry");
});

test("local file preview does not attempt collaboration submission", async () => {
  const page = setup(() => { throw new Error("Unexpected request"); }, { protocol: "file:" });
  await page.submit();
  assert.equal(page.calls.length, 0);
  assert.equal(page.status.textContent, "SOMETHING WENT WRONG. PLEASE TRY AGAIN.");
});
