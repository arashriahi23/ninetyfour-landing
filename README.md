# Ninety Four Homepage

Five-chapter static site for Ninety Four, with a Cloudflare Worker handling Brevo newsletter signup.

## Run locally

Serve the `public` directory with a simple static server:

```bash
cd public
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Integrations

- Newsletter signup posts to `/api/subscribe`. The Worker requires the `BREVO_API_KEY` secret and `BREVO_TEMP_LIST_ID` (currently `4`). Keep the existing Brevo confirmation automation enabled. A static local server does not implement this endpoint.
- Event inquiries use a `mailto:` link to `arash@theninety4.com` with event-detail prompts. There is no configured inquiry-form backend. Opening an email draft does not send an inquiry or confirm a booking.
- Instagram retains the existing `ninetyfour.la` destination.

## Preview and assets

- Review changes on the existing `preview` branch and its Cloudflare preview URL. Production uses `main`; do not merge or push to `main` without explicit publishing approval.
- The horse artwork is served as responsive JPEG copies; the original PNG is retained. The blue court/rug remains uncropped. No imagery is presented as evidence of cart operations or available merchandise.
- Product availability, launch date, booking availability, and the drink menu still need business confirmation. The preview makes no claims about those details.

## Verification

Run `node --test tests/newsletter.test.mjs` for mocked newsletter validation, success, failure, and duplicate-submission behavior. These tests make no network requests. Check the page in desktop and phone viewports, use the chapter menu by keyboard, and inspect the inquiry URL without sending mail. Do not submit real email addresses as a test.
