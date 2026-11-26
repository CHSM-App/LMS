# Backend Services Needed

The website is static (Plesk). The API (`api/`) and everything below run or are bought separately. Local development needs none of the paid services: each one has a free dev fallback. Deployment steps are in [DEPLOY.md](DEPLOY.md).

## Services

| # | Service | Why | Accounts / approvals | Settings (`api/.env`) | Dev / fallback |
|---|---|---|---|---|---|
| 1 | **Node.js hosting** (Plesk Node.js extension, or a VPS + PM2) | Runs `api/` and its scheduled jobs | Node 22 LTS, HTTPS, automatic restart, **one instance** | `PORT`, `NODE_ENV=production`, `WEB_ORIGIN` | `npm run dev` |
| 2 | **SQL Server** 2019+ (Express is fine to start) | Database | Express limits: 10 GB per database, no SQL Agent (jobs run in Node; backups via Plesk or Task Scheduler). An owner login for migrations plus an `lms_app` data-only login. | `DB_SERVER`, `DB_PORT`, `DB_INSTANCE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT=true` | Local SQLEXPRESS |
| 3 | **SMS OTP**: MSG91 | Login and registration OTP | **DLT registration is mandatory in India** (see below) | `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `OTP_SECRET` | `OTP_PROVIDER=console` (dev only; refused in production) |
| 4 | **WhatsApp Business**: Meta Cloud API | Meet links for demos and live classes, enrollment approval, subscription reminders | Verified Meta Business account, a WhatsApp number, **4 approved templates** (below) | `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optional `WHATSAPP_TEMPLATE_<KEY>`. **Or SMSALA** (a Meta BSP): `WHATSAPP_PROVIDER=smsala`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TPL_<KEY>` = the numeric SMSALA template id; OTP over WhatsApp: `OTP_PROVIDER=smsala`, `WHATSAPP_TPL_OTP` | `console`: teachers get a `wa.me` link to send from their own WhatsApp; students still get in-app notifications |
| 5 | **Google Workspace + Calendar API** | Automatic Google Meet links | Workspace account, a Cloud project with the Calendar API, a **service account with domain-wide delegation** for `calendar.events`, and a Workspace user to create events as | `MEET_PROVIDER=google`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_IMPERSONATE_USER` | `manual`: the teacher pastes a Meet link. If Google is down, the app falls back to this automatically. |
| 6 | **File / video storage** | PDFs, thumbnails, uploaded videos, offline downloads | Starts on server disk **outside the web root**. Move to S3-compatible storage or Bunny Stream as volume grows; bandwidth is the main cost. | `STORAGE_DIR`, `FILE_SIGNING_SECRET`, `DOWNLOAD_KEY_SECRET` | Local `./storage` |
| 7 | **HTTPS certificates** | API + website | Let's Encrypt via Plesk, with HSTS. The login cookie is `Secure`, so login only works over HTTPS. | – | `http://localhost` |
| 8 | **Privacy Policy + Terms text** | DPDP Act 2023, Google Play | Legal review of `api/content/legal/*.md`, then Marathi and Hindi versions. Bump the version on every change. | `POLICY_VERSION` | English placeholder text |
| 9 | **Support contact** | Shown on blocked, rejected and expired screens and on `/account/delete-info` | Email address or WhatsApp number | `SUPPORT_CONTACT` | – |
| 10 | **Login and signing secrets** | Sessions, OTP hashing, file links, offline video keys | Long random values, **different per environment**, never committed | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET`, `FILE_SIGNING_SECRET`, `DOWNLOAD_KEY_SECRET` | Generated into the local `.env` |
| 11 | **Google Play Console / Apple Developer** | Mobile app release | Data safety form, account deletion URL, privacy policy URL; a Mac for iOS builds | – | – |
| 12 | SMTP (optional, later) | Email notifications | – | – | – |

## SMS: DLT and MSG91
1. Register the business as a **Principal Entity** on a DLT portal (e.g. Jio, Vodafone Idea or Airtel). This needs PAN, GST or incorporation proof and a letter of authorisation.
2. Register a **6-character sender ID** (header), e.g. `LMSOTP`.
3. Register the **OTP content template** (Service Implicit / OTP category). It must match exactly what MSG91 sends, e.g. `{#var#} is your OTP for <Brand> login. It is valid for 5 minutes. Do not share it with anyone.`
4. In MSG91, add the DLT entity ID, sender ID and template ID, and create an OTP template linked to it. Put its id in `MSG91_TEMPLATE_ID`.
5. Test on staging. If the SMS provider is down, the API answers *"Couldn't send OTP. Try again shortly"* (503), and the failed attempt doesn't count toward the 3-per-15-minutes limit.

## WhatsApp: templates to get approved
Business-initiated messages must use approved templates, in the **Utility** category. Submit each one in **English, Marathi and Hindi** (language codes `en`, `mr`, `hi`); the API sends the user's language. The body parameters must be in this order:

| Template name (default) | Sent when | Body parameters {{1}}… | Suggested English body |
|---|---|---|---|
| `demo_scheduled` | The teacher sends a scheduled demo on WhatsApp | name, course, date, time, Meet link | Hello {{1}}, your live demo for {{2}} is on {{3}} at {{4}}. Join here: {{5}} See you there. |
| `live_class` | A live class is created, and 30 minutes before it starts (targeted batch only) | topic, course, date, time, Meet link | Live class {{1}} for {{2}} is on {{3}} at {{4}}. Join here: {{5}} See you in class. |
| `enrollment_approved` | The teacher approves an enrollment | course, batch | You are enrolled in {{1}} ({{2}}). Open the app to start learning. |
| `subscription_reminder` | A teacher subscription ends within 7 days | name, end date | Hello {{1}}, your teacher subscription ends on {{2}}. Contact the admin to renew. |

- A template must not end (or start) with a variable, or Meta rejects it, so the bodies above end with fixed text.
- SMSALA ids created on 2026-11-25 (status REQUESTED when written): `lms_live_class` = 959 (`WHATSAPP_TPL_LIVE_CLASS`), `lms_demo_scheduled` = 958 (`WHATSAPP_TPL_DEMO_SCHEDULED`). `enrollment_approved` and `subscription_reminder` are not created in SMSALA yet. OTP uses the existing generic Authentication template `otp_auth` (id 463).
- If Meta approves a template under a different name, set `WHATSAPP_TEMPLATE_<KEY>`, e.g. `WHATSAPP_TEMPLATE_LIVE_CLASS=lms_live_class_v2`.
- WhatsApp is sent only to users who **opted in** and are **not blocked**, and only after the database change is saved. In-app notifications are always written.

## Rough monthly costs (**estimates: confirm with each provider before budgeting**)
| Item | Basis | Approx. cost |
|---|---|---|
| VPS or Plesk hosting (API + website) | 2 vCPU / 4 GB RAM / 80 GB disk | ₹1,000 – ₹3,000 / month |
| SQL Server Express | Free (10 GB per database) | ₹0 |
| SMS OTP (MSG91) | ~₹0.20 – ₹0.30 per OTP SMS + DLT registration fee (one-time, ~₹5,900 incl. GST) | 1,000 logins ≈ ₹250 / month |
| WhatsApp (Meta) | Per message; utility templates in India ≈ ₹0.12 – ₹0.15 each | 2,000 messages ≈ ₹300 / month |
| Google Workspace | Business Starter, 1 user for the Meet service account owner | ≈ ₹140 – ₹180 / user / month |
| Video bandwidth | Disk to start; Bunny Stream ≈ $0.005 – $0.01 per GB delivered if moved | Depends on usage |
| Google Play | One-time | $25 |
| Apple Developer | Yearly | $99 / year |

## Setup order for production
1. Create the SQL Server database and the two logins, then run `npm run migrate` with the owner login and `setup-lms-app-role.sql` (see [DEPLOY.md](DEPLOY.md) §1).
2. Deploy the API with `NODE_ENV=production` and every key above. `GET /api/v1/health` must return `"db": "up"`.
3. Register DLT and the OTP template, then set `OTP_PROVIDER=msg91`.
4. Upload the website `dist/` to Plesk and set `WEB_ORIGIN` to its HTTPS address.
5. While the WhatsApp and Google approvals are pending, keep `WHATSAPP_PROVIDER=console` and `MEET_PROVIDER=manual`; teachers use the fallbacks.
6. Publish the reviewed Terms and Privacy text and bump `POLICY_VERSION`.

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
