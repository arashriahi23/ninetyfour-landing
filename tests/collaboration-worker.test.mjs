import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.js";

const env = {
  BREVO_API_KEY: "secret-test-key",
  CONTACT_SENDER_EMAIL: "Admin@theninety4.com",
  ASSETS: { fetch() { throw new Error("Unexpected asset request"); } }
};

function collaborationRequest(overrides = {}) {
  return new Request("https://preview-ninetyfour-landing.championscorner1994.workers.dev/api/collaboration", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://ninetyfourla.com" },
    body: JSON.stringify({
      name: "Arash Riahi",
      email: "hello@example.com",
      type: "Brand activation",
      date: "2026-10-01",
      location: "Los Angeles",
      guests: "94",
      details: "Coffee and music",
      website: "",
      startedAt: Date.now() - 3000,
      ...overrides
    })
  });
}

test("collaboration Worker sends the formatted inquiry only to Admin", async () => {
  const originalFetch = globalThis.fetch;
  let outbound;
  globalThis.fetch = async (...args) => {
    outbound = args;
    return new Response(JSON.stringify({ messageId: "test" }), { status: 201 });
  };
  try {
    const response = await worker.fetch(collaborationRequest(), env);
    assert.equal(response.status, 202);
    assert.equal(outbound[0], "https://api.brevo.com/v3/smtp/email");
    const message = JSON.parse(outbound[1].body);
    assert.deepEqual(message.to, [{ name: "Ninety Four", email: "admin@theninety4.com" }]);
    assert.equal(message.cc, undefined);
    assert.equal(message.bcc, undefined);
    assert.deepEqual(message.replyTo, { name: "Arash Riahi", email: "hello@example.com" });
    assert.equal(message.subject, "NINETY FOUR — NEW COLLABORATION INQUIRY");
    assert.equal(message.textContent, "NINETY FOUR\nNEW COLLABORATION INQUIRY\n\nNAME\nArash Riahi\n\nEMAIL\nhello@example.com\n\nTYPE\nBrand activation\n\nPREFERRED DATE\n2026-10-01\n\nLOCATION\nLos Angeles\n\nGUEST COUNT\n94\n\nADDITIONAL DETAILS\nCoffee and music\n\nSOURCE\nninetyfourla.com — Collaborations");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("collaboration Worker permits optional fields and labels them clearly", async () => {
  const originalFetch = globalThis.fetch;
  let message;
  globalThis.fetch = async (_url, options) => {
    message = JSON.parse(options.body);
    return new Response("{}", { status: 201 });
  };
  try {
    const response = await worker.fetch(collaborationRequest({ type: "", date: "", location: "", guests: "" }), env);
    assert.equal(response.status, 202);
    assert.match(message.textContent, /TYPE\nNot provided/);
    assert.match(message.textContent, /PREFERRED DATE\nNot provided/);
    assert.match(message.textContent, /LOCATION\nNot provided/);
    assert.match(message.textContent, /GUEST COUNT\nNot provided/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("collaboration Worker rejects malformed fields", async () => {
  assert.equal((await worker.fetch(collaborationRequest({ email: "invalid" }), env)).status, 400);
  assert.equal((await worker.fetch(collaborationRequest({ details: "" }), env)).status, 400);
  assert.equal((await worker.fetch(collaborationRequest({ date: "October" }), env)).status, 400);
  assert.equal((await worker.fetch(collaborationRequest({ guests: "many" }), env)).status, 400);
});

test("collaboration Worker blocks untrusted traffic and suppresses bots", async () => {
  const untrustedRequest = collaborationRequest();
  untrustedRequest.headers.set("Origin", "https://example.com");
  assert.equal((await worker.fetch(untrustedRequest, env)).status, 403);
  assert.equal((await worker.fetch(collaborationRequest({ startedAt: Date.now() }), env)).status, 400);

  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("Unexpected request"); };
  try {
    assert.equal((await worker.fetch(collaborationRequest({ website: "spam.example" }), env)).status, 202);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("collaboration Worker reports provider failure instead of success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider failure", { status: 500 });
  try {
    const response = await worker.fetch(collaborationRequest(), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
