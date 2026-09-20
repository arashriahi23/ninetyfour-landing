const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_RECIPIENT = "Admin@theninety4.com";
const MAX_CONTACT_BYTES = 20_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function isTrustedOrigin(origin) {
  if (!origin) return true;

  try {
    const { hostname } = new URL(origin);
    return hostname === "ninetyfourla.com" ||
      hostname === "www.ninetyfourla.com" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".championscorner1994.workers.dev");
  } catch {
    return false;
  }
}

async function subscribe(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!isTrustedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403);
  if (!env.BREVO_API_KEY || !env.BREVO_TEMP_LIST_ID) return json({ error: "Newsletter service is not configured." }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Enter a valid email address." }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return json({ error: "Enter a valid email address." }, 400);

  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      email,
      listIds: [Number(env.BREVO_TEMP_LIST_ID)],
      updateEnabled: true
    })
  });

  if (!response.ok) {
    console.error("Brevo subscribe failed", response.status, await response.text());
    return json({ error: "Unable to subscribe right now. Please try again." }, 502);
  }

  return json({ ok: true }, 202);
}

async function contact(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!isTrustedOrigin(request.headers.get("Origin"))) return json({ error: "Invalid request origin." }, 403);
  if (!env.BREVO_API_KEY || !env.CONTACT_SENDER_EMAIL) return json({ error: "Contact service is not configured." }, 503);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_CONTACT_BYTES) return json({ error: "Message is too large." }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Enter your name, email, and message." }, 400);
  }

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();
  const honeypot = String(payload.website || "").trim();
  const startedAt = Number(payload.startedAt);
  const elapsed = Date.now() - startedAt;

  if (honeypot) return json({ ok: true }, 202);
  if (!Number.isFinite(startedAt) || elapsed < 1500 || elapsed > 7_200_000) {
    return json({ error: "Please refresh the page and try again." }, 400);
  }
  if (name.length < 2 || name.length > 100) return json({ error: "Enter your name." }, 400);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
  if (message.length < 2 || message.length > 5000) return json({ error: "Enter a message." }, 400);

  const safeName = name.replace(/[\r\n]+/g, " ");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: "Ninety Four Website", email: env.CONTACT_SENDER_EMAIL },
      to: [{ name: "Ninety Four", email: CONTACT_RECIPIENT }],
      replyTo: { name: safeName, email },
      subject: `Website contact from ${safeName}`,
      textContent: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    })
  });

  if (!response.ok) {
    console.error("Brevo contact email failed", response.status, await response.text());
    return json({ error: "Unable to send your message right now. Please try again." }, 502);
  }

  return json({ ok: true }, 202);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscribe") return subscribe(request, env);
    if (url.pathname === "/api/contact") return contact(request, env);
    return env.ASSETS.fetch(request);
  }
};
