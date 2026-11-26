# SMSALA WhatsApp Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the four WhatsApp template messages through SMSALA when `WHATSAPP_PROVIDER=smsala`.

**Architecture:** A new `smsala.js` provider with the same `send(mobile, text, { template, lang, vars })` interface as `meta`, registered in `providers/whatsapp/index.js`. Template keys map to SMSALA numeric ids from env. The demo-request caller is fixed to pass `vars`.

**Tech Stack:** Node (global `fetch`), Jest, the existing `tests/setup/fetchMock.js`.

**Spec:** `docs/superpowers/specs/2026-11-25-smsala-whatsapp-provider-design.md`

## Global Constraints

- Endpoint: `POST https://api2.smsala.com/whatsapp/SendMessage`, `application/x-www-form-urlencoded`.
- Form fields: `ApiToken`, `TemplateId`, `QuickNumber` (`91XXXXXXXXXX`, no `+`), `Sample` (values joined by `,` in `TEMPLATE_PARAMS` order), `CampaignName`.
- Success: `IsSuccess === true` or `ErrorCode === 0`. Otherwise throw an `Error` containing `ErrorDescription`.
- Env: `WHATSAPP_PROVIDER=smsala`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TPL_<KEY>` where KEY is the upper-case template key (`DEMO_SCHEDULED`, `LIVE_CLASS`, `ENROLLMENT_APPROVED`, `SUBSCRIPTION_REMINDER`).
- Commas are removed from values; an empty or missing value becomes `-`. Request timeout 10 s.
- No token value in any committed file or log. CLAUDE.md rules apply (TDD, no hard-coded colours not relevant here, `docs/openapi.yaml` unchanged since no endpoint changes).

## Review Focus

- A value with a comma (`Maths, Class 10`) must not shift later variables.
- A missing or empty variable must not produce an empty `Sample` slot.
- Missing token or template id must throw, not call the API (callers then use the `wa.me` fallback).
- A plain-text send (no `template`) must throw, not hit the API.
- A `+919812345678` mobile must go out as `919812345678`.
- The demo request must pass `vars`, or SMSALA sends blank variables.

---

### Task 1: SMSALA provider

**Files:**
- Create: `api/src/providers/whatsapp/smsala.js`
- Modify: `api/src/providers/whatsapp/index.js` (`provider()` and the header comment)
- Test: `api/tests/unit/providers.test.js` (new `describe('SMSALA WhatsApp')` after the Cloud API block)

**Interfaces:**
- Consumes: `TEMPLATE_PARAMS` from `./index` (circular import risk: pass it in instead, see Step 3).
- Produces: `smsala.send(mobile: string, text: string, meta: { template?: string, lang?: string, vars?: object }): Promise<{ ok: true, campaignId?: string }>`.

- [ ] **Step 1: Write the failing tests.** In the new `describe`, a `beforeEach` sets `WHATSAPP_PROVIDER='smsala'`, `WHATSAPP_API_TOKEN='sm-token'`, `WHATSAPP_TPL_LIVE_CLASS='959'`, `WHATSAPP_TPL_DEMO_SCHEDULED='958'`. Tests (names exact):
  - `sends the template id, token, number and ordered values`: reply `https://api2.smsala.com/whatsapp/SendMessage` 200 `{ IsSuccess: true, ErrorCode: 0, ReturnData: '77' }`; call `send('+919812345678', 'x', { template: 'live_class', vars: { topic: 'Algebra', course: 'Maths', date: '2026-06-15', time: '09:00', link: 'https://meet.google.com/abc-defg-hij' } })`; expect `http.calls[0].body` toMatchObject `{ ApiToken: 'sm-token', TemplateId: '959', QuickNumber: '919812345678', Sample: 'Algebra,Maths,2026-06-15,09:00,https://meet.google.com/abc-defg-hij' }` and `http.calls[0].headers['content-type']` toBe `'application/x-www-form-urlencoded'`.
  - `removes commas from values and fills empty ones with a dash`: vars `{ topic: 'A, B', course: '', date: '1', time: '2' }` (link missing) gives `Sample` `'A B,-,1,2,-'`.
  - `an unsuccessful reply throws the provider message`: reply 200 `{ IsSuccess: false, ErrorCode: 5, ErrorDescription: 'Template not approved' }` rejects with `'Template not approved'`.
  - `an HTTP error throws`: reply 500, rejects with `'500'`.
  - `missing token or template id throws without calling the API`: delete `WHATSAPP_API_TOKEN`, expect rejection; then restore token, delete `WHATSAPP_TPL_LIVE_CLASS`, expect rejection; `http.calls` has length 0.
  - `plain text without a template throws`: `send('+919812345678', 'hello')` rejects with `'template'`; no calls.
  - `index.js selects it`: `require('../../src/providers/whatsapp')` (after env set) `.send(...)` produces a call to the SMSALA URL.

- [ ] **Step 2: Run to verify they fail.**
  Run: `cd api && npx jest tests/unit/providers.test.js -t "SMSALA" `
  Expected: FAIL (module `smsala` not found / no SMSALA request made).

- [ ] **Step 3: Implement `send` in `smsala.js`.** Export `{ name: 'smsala', send }` and a factory-free module taking `TEMPLATE_PARAMS` lazily (`require('./index').TEMPLATE_PARAMS` inside `send`, to avoid a load-time cycle). Build the body with `URLSearchParams`, use `fetch` with `AbortSignal.timeout(10000)`, `CampaignName` is the template key. Do not log the token or the response body beyond `ErrorDescription`.

- [ ] **Step 4: Register in `index.js`.** `provider()` returns `smsala` for `WHATSAPP_PROVIDER === 'smsala'`, `metaProvider` for `'meta'`, otherwise console. Update the header comment to list `smsala`.

- [ ] **Step 5: Run to verify they pass.**
  Run: `cd api && npx jest tests/unit/providers.test.js`
  Expected: all PASS (existing Cloud API tests included).

- [ ] **Step 6: Commit.**
  ```bash
  git add api/src/providers/whatsapp api/tests/unit/providers.test.js
  git commit -m "feat(whatsapp): SMSALA provider selected with WHATSAPP_PROVIDER=smsala"
  ```

### Task 2: Pass `vars` for the demo request

**Files:**
- Modify: `api/src/services/demoRequest.service.js:73`
- Test: `api/tests/integration/teacher/operations.test.js`

**Interfaces:**
- Consumes: `whatsapp.send(mobile, text, { template, lang, vars })` from Task 1 (unchanged signature).
- Produces: `vars` shape `{ name, course, date, time, link }`, matching `TEMPLATE_PARAMS.demo_scheduled`.

- [ ] **Step 1: Write the failing test** next to the existing send-on-WhatsApp test (near line 33): `jest.spyOn(whatsapp, 'send')`, send the demo WhatsApp, expect the spy's third argument toMatchObject `{ template: 'demo_scheduled', vars: { name: <request name>, course: <course title>, date: <IST date>, time: <IST time>, link: <meetLink> } }`. Use the values already available in that test's fixtures.

- [ ] **Step 2: Run to verify it fails.**
  Run: `cd api && npx jest tests/integration/teacher/operations.test.js -t "vars"`
  Expected: FAIL (`vars` undefined).

- [ ] **Step 3: Fix the call** at `demoRequest.service.js:73` to pass `vars: { name: r.name, course: r.course_title, date, time, link: r.meet_link }` (the same values already used for `text` on line 69).

- [ ] **Step 4: Run to verify it passes.**
  Run: `cd api && npx jest tests/integration/teacher/operations.test.js`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  ```bash
  git add api/src/services/demoRequest.service.js api/tests/integration/teacher/operations.test.js
  git commit -m "fix(demo): pass template variables when sending the demo on WhatsApp"
  ```

### Task 3: Config and docs

**Files:**
- Modify: `api/.env.example` (lines 24-27), `docs/BACKEND_NEEDS.md` (WhatsApp section and the template table)

**Interfaces:** none.

- [ ] **Step 1: `.env.example`.** Document `WHATSAPP_PROVIDER` as `console | meta | smsala`, add `WHATSAPP_API_TOKEN=` (empty) and `WHATSAPP_TPL_DEMO_SCHEDULED=`, `WHATSAPP_TPL_LIVE_CLASS=`, `WHATSAPP_TPL_ENROLLMENT_APPROVED=`, `WHATSAPP_TPL_SUBSCRIPTION_REMINDER=` all empty. No real values.

- [ ] **Step 2: `BACKEND_NEEDS.md`.** In the provider table row 4, add the SMSALA option and its env vars. In the template table, change the suggested bodies so none ends with a variable (Meta rejects that): `live_class` and `demo_scheduled` end with `See you in class.` / `See you there.` (exact texts as submitted in SMSALA: `Live class {{1}} for {{2}} is on {{3}} at {{4}}. Join here: {{5}} See you in class.` and `Hello {{1}}, your live demo for {{2}} is on {{3}} at {{4}}. Join here: {{5}} See you there.`); give `enrollment_approved` and `subscription_reminder` a fixed closing sentence too. Record the SMSALA ids `lms_live_class` = 959 and `lms_demo_scheduled` = 958, and that the other two are not yet created.

- [ ] **Step 3: Verify.**
  Run: `cd api && npm test`
  Expected: full suite PASS.

- [ ] **Step 4: Commit.**
  ```bash
  git add api/.env.example docs/BACKEND_NEEDS.md
  git commit -m "docs(whatsapp): SMSALA env vars and template texts"
  ```

### Task 5: OTP over WhatsApp (SMSALA)

All OTP flows (login, student registration, teacher request, demo request, mobile change, account delete) go through `otpSender()`, so one provider covers teacher registration too. Template `463` (`otp_auth`, Authentication, APPROVED, generic text) is reused.

**Files:**
- Create: `api/src/providers/otp/smsala.js`
- Modify: `api/src/providers/otp/index.js` (register `smsala`), `api/.env.example` (`OTP_PROVIDER` comment, `WHATSAPP_TPL_OTP=`)
- Test: `api/tests/unit/providers.test.js` (new `describe('SMSALA OTP')`)

**Interfaces:**
- Produces: `smsala.send(mobile: string, code: string): Promise<void>`, same shape as `msg91.send`, so `otp.service.js` needs no change.

- [ ] **Step 1: Write the failing tests** (env: `WHATSAPP_API_TOKEN='sm-token'`, `WHATSAPP_TPL_OTP='463'`):
  - `posts the code, number, token and template id`: reply `https://api2.smsala.com/whatsapp/SendOtp` 200 `{ IsSuccess: true, ErrorCode: 0 }`; `send('+919812345678', '123456')`; `http.calls[0].body` toMatchObject `{ PhoneNumber: '919812345678', OtpCode: '123456', ApiToken: 'sm-token', TemplateId: '463' }`, method POST, JSON body.
  - `an unsuccessful reply throws the provider message`: `{ IsSuccess: false, ErrorCode: 7, ErrorDescription: 'Invalid number' }` rejects with `'Invalid number'`.
  - `an HTTP error throws`: 500 rejects with `'500'`.
  - `a missing token throws without calling the API`.
  - `the error never contains the token or the code`: for a failing reply, `error.message` does not include `'sm-token'` or `'123456'`.
  - `otpSender() returns smsala for OTP_PROVIDER=smsala`, and `console` is still refused in production.

- [ ] **Step 2: Run to verify they fail.**
  Run: `cd api && npx jest tests/unit/providers.test.js -t "SMSALA OTP"`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `send(mobile, code)`** in `smsala.js`: `fetch` POST JSON to `https://api2.smsala.com/whatsapp/SendOtp`, `AbortSignal.timeout(10000)`, success when `IsSuccess === true || ErrorCode === 0`, else throw `Error(ErrorDescription || 'SMSALA OTP failed')`. Register in `otp/index.js`.

- [ ] **Step 4: Run to verify they pass.**
  Run: `cd api && npx jest tests/unit/providers.test.js && npm test`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  ```bash
  git add api/src/providers/otp api/tests/unit/providers.test.js api/.env.example
  git commit -m "feat(otp): send OTP over WhatsApp with SMSALA (OTP_PROVIDER=smsala)"
  ```

Known risk (not built now): a user without WhatsApp cannot receive an OTP. A fallback to MSG91 SMS is a later task and needs DLT.

### Task 4: Live smoke check (manual, after Meta approves 959 and 958)

- [ ] **Step 1:** On a non-production machine, set `WHATSAPP_PROVIDER=smsala`, the real token and `WHATSAPP_TPL_LIVE_CLASS=959`, `WHATSAPP_TPL_DEMO_SCHEDULED=958` in a local `.env` only.
- [ ] **Step 2:** Send a demo WhatsApp to the owner's own opted-in mobile from the teacher screen.
  Expected: message arrives with all five variables filled; `whatsapp_sent_at` is set.
- [ ] **Step 3:** Set a wrong template id; expect the API to answer 502 `WHATSAPP_FAILED` with a `fallbackUrl`.
