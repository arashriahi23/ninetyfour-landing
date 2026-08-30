const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function isTrustedOrigin(origin) {
  if (!origin) return true;

  const { hostname } = new URL(origin);
  return hostname === "ninetyfourla.com" ||
    hostname === "www.ninetyfourla.com" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".championscorner1994.workers.dev");
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscribe") return subscribe(request, env);
    return env.ASSETS.fetch(request);
  }
};
