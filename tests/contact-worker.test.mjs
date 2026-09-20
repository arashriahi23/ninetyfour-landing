import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.js";

const env = {
  BREVO_API_KEY: "secret-test-key",
  CONTACT_SENDER_EMAIL: "Admin@theninety4.com",
  ASSETS: { fetch() { throw new Error("Unexpected asset request"); } }
};

function contactRequest(overrides = {}) {
  return new Request("https://preview-ninetyfour-landing.championscorner1994.workers.dev/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://ninetyfourla.com" },
    body: JSON.stringify({
      name: "Arash Riahi",
      email: "hello@example.com",
      message: "I would like to learn more.",
      website: "",
      startedAt: Date.now() - 3000,
      ...overrides
    })
  });
}

test("contact Worker sends only to Admin and uses visitor as reply-to", async () => {
  const originalFetch = globalThis.fetch;
  let outbound;
  globalThis.fetch = async (...args) => {
    outbound = args;
    return new Response(JSON.stringify({ messageId: "test" }), { status: 201 });
  };
  try {
    const response = await worker.fetch(contactRequest(), env);
    assert.equal(response.status, 202);
    assert.equal(outbound[0], "https://api.brevo.com/v3/smtp/email");
    const message = JSON.parse(outbound[1].body);
    assert.deepEqual(message.to, [{ name: "Ninety Four", email: "admin@theninety4.com" }]);
    assert.equal(message.cc, undefined);
    assert.equal(message.bcc, undefined);
    assert.deepEqual(message.replyTo, { name: "Arash Riahi", email: "hello@example.com" });
    assert.equal(message.sender.email, "Admin@theninety4.com");
    assert.equal(message.subject, "NINETY FOUR — NEW CONTACT MESSAGE");
    assert.equal(message.textContent, "NINETY FOUR\nNEW CONTACT MESSAGE\n\nNAME\nArash Riahi\n\nEMAIL\nhello@example.com\n\nMESSAGE\nI would like to learn more.\n\nSOURCE\nninetyfourla.com — Contact");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("contact Worker rejects malformed input and reports provider failure", async () => {
  assert.equal((await worker.fetch(contactRequest({ email: "invalid" }), env)).status, 400);
  assert.equal((await worker.fetch(contactRequest({ message: "" }), env)).status, 400);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider failure", { status: 500 });
  try {
    const response = await worker.fetch(contactRequest(), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("contact Worker rejects untrusted origins and invalid timing", async () => {
  const untrustedRequest = contactRequest();
  untrustedRequest.headers.set("Origin", "https://example.com");
  assert.equal((await worker.fetch(untrustedRequest, env)).status, 403);
  assert.equal((await worker.fetch(contactRequest({ startedAt: Date.now() }), env)).status, 400);
});

test("contact Worker silently accepts honeypot submissions without sending", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("Unexpected request"); };
  try {
    const response = await worker.fetch(contactRequest({ website: "spam.example" }), env);
    assert.equal(response.status, 202);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
