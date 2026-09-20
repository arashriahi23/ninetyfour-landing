# Ninety Four Homepage

Five-chapter static site for Ninety Four, with a Cloudflare Worker handling Brevo newsletter signup, collaboration inquiries, and general contact submissions.

## Run locally

Serve the `public` directory with a simple static server:

```bash
cd public
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Integrations

- Newsletter signup posts to `/api/subscribe`. The Worker requires the `BREVO_API_KEY` secret and `BREVO_TEMP_LIST_ID` (currently `4`). Keep the existing Brevo confirmation automation enabled. A static local server does not implement this endpoint.
- Collaboration inquiries post to `/api/collaboration`; general contact messages post to `/api/contact`. The Worker validates both payloads and sends them only to `admin@theninety4.com` through Brevo transactional email. The visitor's address is used as `replyTo`, so replying from the inbox addresses the visitor directly.
- Both form endpoints require the existing `BREVO_API_KEY` Cloudflare secret and `CONTACT_SENDER_EMAIL` Cloudflare variable. `CONTACT_SENDER_EMAIL` must be a sender verified in Brevo. No additional provider account is needed when the existing Ninety Four Brevo account remains active.
- API keys and sender credentials are never exposed to the browser. Configure `BREVO_API_KEY` under the Worker's Cloudflare **Settings > Variables and Secrets** as an encrypted secret. Configure `CONTACT_SENDER_EMAIL` there as a text variable for both preview and production environments. Keep `BREVO_TEMP_LIST_ID` as a text variable for newsletter signup.
- Brevo sender verification is required. Domain authentication through the DNS records Brevo supplies is strongly recommended for reliable delivery and may be required by the selected sender configuration.
- The public forms use a hidden honeypot, a minimum completion-time check, origin checks, request-size limits, and server-side field validation. Cloudflare Turnstile is not required for this release, so there are no Turnstile keys to configure. Add Turnstile later if real traffic shows that these unobtrusive controls are insufficient.
- Instagram retains the existing `ninetyfour.la` destination.

## Preview and assets

- Review changes on the existing `preview` branch and its Cloudflare preview URL. Production uses `main`; do not merge or push to `main` without explicit publishing approval.
- The horse artwork is served as responsive JPEG copies; the original PNG is retained. The blue court/rug remains uncropped. No imagery is presented as evidence of cart operations or available merchandise.
- The Shop is an editorial category index only. It contains no fabricated products, prices, inventory, checkout, release dates, or Shopify integration.

## Verification

Run `node --test tests/*.test.mjs` for mocked newsletter and form validation, successful provider responses, provider failures, malformed input, anti-spam controls, and duplicate-submission behavior. These tests make no external network requests.

To verify real delivery after deploying the Worker:

1. Confirm `BREVO_API_KEY`, `CONTACT_SENDER_EMAIL`, and `BREVO_TEMP_LIST_ID` are configured in the target Cloudflare Worker environment.
2. Submit one clearly labeled test through Collaborations and one through Contact on the deployed site.
3. Confirm each form shows its success message only after the request completes.
4. Confirm `admin@theninety4.com` receives both messages with the expected subject, field layout, and visitor Reply-To address. Check spam/quarantine and Brevo transactional logs if either message is delayed.
