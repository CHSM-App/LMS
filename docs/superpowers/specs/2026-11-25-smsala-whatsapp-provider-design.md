# SMSALA WhatsApp provider: design

Approved by the user in chat on 2026-11-25 (short design, small change).

## Intent and why
The owner already pays for an SMSALA WhatsApp API (the same account that serves their Billing_Software project) and does not want to set up a separate Meta Cloud API account. WhatsApp messages (demo link, live-class reminder, enrollment approved, subscription reminder) must go out through SMSALA.

## Goals
- A new provider `api/src/providers/whatsapp/smsala.js`, selected with `WHATSAPP_PROVIDER=smsala`.
- Same interface as the existing providers: `send(mobile, text, { template, lang, vars })`. No caller changes except the demo bug below.
- Template key maps to an SMSALA numeric template id from env.
- Failures throw, so existing callers keep using the `wa.me` fallback.

## Non-goals / anti-goals
- No OTP over WhatsApp (OTP stays on `providers/otp`; decision pending with the owner).
- No delivery-status webhook, no retries (can follow later).
- The Meta provider stays as is.
- The token is never committed, logged or put in `.env.example` with a real value.

## Constraints
- DECISIONS.md says the official Meta API is preferred. SMSALA is a Meta-approved BSP; the owner chose it for cost/availability. Recorded as a deviation.
- SMSALA protocol (from the Billing_Software project's working client):
  `POST https://api2.smsala.com/whatsapp/SendMessage`, `application/x-www-form-urlencoded`,
  fields `ApiToken`, `TemplateId`, `QuickNumber` (91XXXXXXXXXX), `Sample` (comma-separated variable values in order), `CampaignName`.
  Success is `IsSuccess === true` or `ErrorCode === 0`; the campaign id is in `ReturnData`.
- Because `Sample` is comma-separated, commas inside values must be removed or they shift later variables. Empty values become `-`.
- A 10 s timeout on the request.
- Variables at the end of a Meta template are rejected, so the templates end with fixed text. `docs/BACKEND_NEEDS.md` is updated to match.

## Approaches considered
1. **Add an `smsala` provider next to `meta` (chosen).** Keeps Meta usable, small and isolated.
2. Replace the Meta provider with SMSALA. Simpler, but locks the project to one vendor.
3. A generic "BSP" provider driven by config. Over-built for one vendor.

## Design
- Env: `WHATSAPP_PROVIDER=smsala`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TPL_<KEY>` (`DEMO_SCHEDULED`, `LIVE_CLASS`, `ENROLLMENT_APPROVED`, `SUBSCRIPTION_REMINDER`).
- Values come from the existing `TEMPLATE_PARAMS` order in `providers/whatsapp/index.js`.
- A missing token or template id throws a clear error (caller falls back to `wa.me`).
- Messages without a template (plain text) are not supported by SMSALA: throw.
- Template ids created in SMSALA on 2026-11-25 (status REQUESTED, to be approved by Meta): `lms_live_class` = 959, `lms_demo_scheduled` = 958. `enrollment_approved` and `subscription_reminder` are not created yet.
- Language: one template id per key (English). `lang` is ignored for now.

## Found while reading the code (fix in the same change)
`demoRequest.service.js` calls `whatsapp.send(mobile, text, { template: 'demo_scheduled' })` **without `vars`**, so a template provider would send blank variables. It must pass `{ name, course, date, time, link }`.

## Left to the builder
File layout inside the provider, test helper use (`tests/setup` http mock), openapi needs no change (no endpoint changes).
