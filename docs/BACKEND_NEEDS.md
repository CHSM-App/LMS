# Backend Services Needed

The web build is static (Plesk). Everything below runs or is bought separately.

| # | Service | Why | Notes / approvals | Dev fallback |
|---|---|---|---|---|
| 1 | **Node.js hosting** (Plesk Node.js extension or a VPS + PM2) | Runs `api/` | Node 22 LTS, HTTPS, env vars, process restart | `npm run dev` |
| 2 | **SQL Server** (2019+; Express is OK to start) | Database | Express limits: 10 GB, no SQL Agent (jobs run in Node). Daily backups + a tested restore. Separate `lms_app` (data only) and migration logins. | Local SQLEXPRESS |
| 3 | **SMS OTP provider** (e.g. MSG91) | Login OTP | **DLT registration** (entity + sender ID + OTP template) is mandatory in India | `OTP_PROVIDER=console` logs the OTP |
| 4 | **WhatsApp Business API** (Meta Cloud API) | Meet links, reminders | Verified Meta Business account, approved templates (demo scheduled, live class, enrollment approved, subscription reminder), recipient opt-in, per-conversation cost | `wa.me` link opened by the teacher |
| 5 | **Google Workspace + Calendar API** | Automatic Google Meet links | OAuth consent screen + service setup | Teacher pastes a Meet link |
| 6 | **File / video storage** | PDFs, thumbnails, uploaded videos, offline downloads | Starts on server disk (`STORAGE_DIR`, outside the web root). Move to S3-compatible storage / Bunny Stream as volume grows. Bandwidth is the main cost. | Local `./storage` |
| 7 | **HTTPS certificates** | API + web | Let's Encrypt via Plesk | – |
| 8 | **Privacy policy + Terms text** | DPDP Act 2023, Google Play | Legal review; versioned (`POLICY_VERSION`) | Placeholder text |
| 9 | **Support contact** | Shown on blocked/rejected/expired screens | Email or WhatsApp number (`SUPPORT_CONTACT`) | Placeholder |
| 10 | **Google Play / App Store accounts** | Mobile app release | Data safety form, account deletion URL, privacy URL | – |
| 11 | SMTP (optional) | Email notifications later | – | – |
