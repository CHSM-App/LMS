# Backend Services Needed

The website build is static (Plesk). The API (`api/`) and everything below run or are bought separately.
For local development you need none of the paid services: each one has a free dev fallback.

## Services

| # | Service | Why | Notes / approvals | `.env` keys (in `api/.env`) | Dev fallback |
|---|---|---|---|---|---|
| 1 | **Node.js hosting** (Plesk Node.js extension, or a VPS + PM2) | Runs `api/` | Node 22 LTS, HTTPS, automatic restart | `PORT`, `NODE_ENV=production`, `WEB_ORIGIN` | `npm run dev` |
| 2 | **SQL Server** (2019+; Express is fine to start) | Database | Express limits: 10 GB per database, no SQL Agent (scheduled jobs run inside Node). Daily backups + one tested restore. Use a data-only `lms_app` login for the API and a separate login for migrations. | `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT=true` | Local SQLEXPRESS |
| 3 | **SMS OTP provider** (e.g. MSG91) | Login OTP | **DLT registration** (entity + sender ID + OTP template) is mandatory in India. The `console` provider is refused when `NODE_ENV=production`. | `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `OTP_SECRET` | `OTP_PROVIDER=console` prints the OTP in the API log |
| 4 | **WhatsApp Business API** (Meta Cloud API) | Meet links, class reminders, subscription reminders | Verified Meta Business account, approved message templates (demo scheduled, live class, enrollment approved, subscription reminder), recipient opt-in, per-conversation cost | `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | `wa.me` link opened from the teacher's own WhatsApp |
| 5 | **Google Workspace + Calendar API** | Automatic Google Meet links | OAuth consent screen, a service account with domain-wide delegation, the calendar to create events in | `MEET_PROVIDER=google`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID` | `MEET_PROVIDER=manual`: the teacher pastes a Meet link |
| 6 | **File / video storage** | PDFs, thumbnails, uploaded videos, offline downloads | Starts on server disk, **outside the web root**. Move to S3-compatible storage or Bunny Stream as volume grows; bandwidth is the main cost. | `STORAGE_DIR`, `FILE_SIGNING_SECRET`, `DOWNLOAD_KEY_SECRET` | Local `./storage` |
| 7 | **HTTPS certificates** | API + website | Let's Encrypt via Plesk. The refresh cookie is `Secure`, so login only works over HTTPS in production. | – | `http://localhost` |
| 8 | **Privacy Policy + Terms text** | DPDP Act 2023, Google Play | Legal review of `api/content/legal/*.md`, then Marathi/Hindi versions. Bump the version whenever the text changes. | `POLICY_VERSION` | English placeholder text |
| 9 | **Support contact** | Shown on blocked, rejected and expired screens | Email address or WhatsApp number | `SUPPORT_CONTACT` | Placeholder email |
| 10 | **Login secrets** | Signing sessions | Long random values, different per environment, never committed | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Generated into the local `.env` |
| 11 | **Google Play / App Store accounts** | Mobile app release | Data safety form, account deletion URL, privacy policy URL | – | – |
| 12 | SMTP (optional) | Email notifications later | – | – | – |

## Setup order for production
1. Create the SQL Server database and the two logins; run `npm run migrate` with the migration login.
2. Deploy the API with `NODE_ENV=production` and every key above; check `GET /api/v1/health` returns `"db": "up"`.
3. Register the DLT entity and OTP template, then switch `OTP_PROVIDER` to `msg91`.
4. Upload the website `dist/` to Plesk and set `WEB_ORIGIN` to its HTTPS address.
5. While the WhatsApp and Google approvals are pending, keep `WHATSAPP_PROVIDER=console` and `MEET_PROVIDER=manual`; teachers use the fallbacks.
6. Publish the reviewed Terms and Privacy text and bump `POLICY_VERSION`.

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
