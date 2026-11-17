# Deployment Guide

Three parts go live separately:

| Part | What it is | Where it runs |
|---|---|---|
| **API** (`api/`) | Node 22 + Express, talks to SQL Server, runs the scheduled jobs | Plesk Node.js extension, or a VPS with PM2 |
| **Website** (`web/`) | Static files built into `web/dist/` | Plesk document root (Apache or IIS) |
| **Mobile app** (`mobile/`) | Flutter, Android + iOS | Google Play / App Store |

Do a **staging** deployment first (same steps, separate database, domain and secrets), run the smoke test at the end of this guide, then repeat for production. Paid services and approvals are listed in [BACKEND_NEEDS.md](BACKEND_NEEDS.md). The release checklist is [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

---

## 1. Database (SQL Server 2019+)

1. Create an **empty** database, e.g. `LearningDB`.
2. Create **two logins**:
   - an **owner login** (db_owner): used only to run migrations
   - an **app login**: what the API uses day to day
3. Run the migrations **as the owner login**. Values typed on the command line override `api/.env` for that one run:
   ```bash
   cd api
   npm ci --omit=dev
   DB_USER=<owner_login> DB_PASSWORD=<owner_password> npm run migrate
   ```
   (PowerShell: `$env:DB_USER='<owner_login>'; $env:DB_PASSWORD='<owner_password>'; npm run migrate`)
4. As the owner or DBA, run `api/scripts/sql/setup-lms-app-role.sql` once. Then add the app login to the role:
   ```sql
   ALTER ROLE lms_app ADD MEMBER [<app_login>];
   ```
   The app login can now read and write data only. It cannot change tables, and it **cannot update or delete the audit log**.
5. Create the first admin. Set `SEED_ADMIN_MOBILE` (`+91XXXXXXXXXX`) and `SEED_ADMIN_NAME` in `api/.env`, then run `npm run seed`.
6. Encryption: keep `DB_ENCRYPT=true`. **Never set `DB_TRUST_SERVER_CERT=true` in production**; that setting exists only for the self-signed test server. Give the SQL Server a real certificate instead.

### Backups (SQL Server Express has no SQL Agent)
- **Plesk:** Tools & Settings → Backup Manager → schedule a **daily** backup that includes databases. Keep at least 14 days, plus a copy off the server.
- **Windows VPS:** a Task Scheduler job runs daily at 02:00:
  ```bat
  sqlcmd -S .\SQLEXPRESS -E -Q "BACKUP DATABASE [LearningDB] TO DISK = N'D:\backups\LearningDB_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%.bak'  WITH CHECKSUM, INIT"
  ```
  Copy the files off the server and delete files older than 14 days.
- **Restore test (required before go-live):** restore last night's backup into a new database (`LearningDB_restore`), point a staging API at it, and log in. Write down the date and time it took.
- Back up the **`STORAGE_DIR` folder** as well (uploaded PDFs, thumbnails, videos), on the same schedule.

---

## 2. API

### Settings (`api/.env` on the server; never committed)
Copy `api/.env.example` and fill every key. Production values:

| Key | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | The port Plesk/PM2 gives the app (e.g. `4000`) |
| `DB_SERVER`, `DB_PORT`, `DB_INSTANCE`, `DB_NAME` | Production database |
| `DB_USER`, `DB_PASSWORD` | The **app login** (not the owner) |
| `DB_ENCRYPT` | `true` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_SECRET`, `DOWNLOAD_KEY_SECRET`, `FILE_SIGNING_SECRET` | **New** random values for this environment, at least 32 bytes each: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `WEB_ORIGIN` | The website address exactly, e.g. `https://learn.example.com` (CORS only allows this origin) |
| `STORAGE_DIR` | A folder **outside** any web root, e.g. `/var/lms/storage` or `D:\lms\storage` |
| `OTP_PROVIDER` | `msg91` (the `console` provider is refused in production) |
| `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | From MSG91, after DLT approval |
| `WHATSAPP_PROVIDER` | `meta` once the templates are approved; until then `console` (teachers use the wa.me fallback) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_*` | Meta Cloud API (see BACKEND_NEEDS.md) |
| `MEET_PROVIDER` | `google` once Workspace is set up; until then `manual` (teachers paste Meet links) |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_IMPERSONATE_USER` | Google Workspace service account |
| `SUPPORT_CONTACT` | Support email or WhatsApp number shown to users |
| `POLICY_VERSION` | Version of the published Terms/Privacy text |

Do **not** set `DB_TEST_NAME` or `DB_TRUST_SERVER_CERT` in production.

### Option A: Plesk Node.js extension
1. Upload the `api/` folder (no `node_modules`, no `.env`, no `storage*`) to e.g. `/api.example.com/app`.
2. Websites & Domains → Node.js:
   - Node version: **22**
   - Application root: the uploaded `app` folder
   - Application startup file: `src/server.js`
   - Application mode: `production`
3. Click **NPM install** (equivalent to `npm ci --omit=dev`). Put `.env` in the application root.
4. Enable **SSL/TLS** (Let's Encrypt) and turn on "Permanent SEO-safe 301 redirect from HTTP to HTTPS" plus **HSTS**.
5. Restart the app and open `https://api.example.com/api/v1/health`. It must return `"db": "up"`.

### Option B: VPS + PM2
```bash
cd /srv/lms/api && npm ci --omit=dev
pm2 start src/server.js --name lms-api --time --max-memory-restart 600M
pm2 save && pm2 startup
pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 20M && pm2 set pm2-logrotate:retain 14
```
Put Nginx or IIS in front with HTTPS (Let's Encrypt), HSTS and `client_max_body_size 8m`. Uploads are chunked at 5 MB.

### Important rules
- **Run exactly one API instance.** The scheduled jobs (reminders, exam auto-submit, upload and OTP cleanup) run inside the API process. Each job claims its rows, so a duplicate run does no harm, but one instance is the supported setup.
- **Same site, HTTPS:** the login cookie is `Secure; SameSite=Strict`. The website and API must both be HTTPS on the same registrable domain (e.g. `learn.example.com` + `api.example.com`), or the API must be proxied under the website's `/api`.
- The API trusts one proxy hop (`trust proxy 1`), so rate limits see the real client IP behind Plesk/Nginx.
- **Logs:**
  - One JSON line per security or provider event (`otp_failed`, `token_reuse`, `forbidden`, `whatsapp_failed`, `meet_link_failed`, `server_error`).
  - They never contain OTPs, tokens or full mobile numbers.
  - Keep 14+ days (pm2-logrotate, or Plesk log rotation).
- **Uploads:** check that `STORAGE_DIR` has room (videos up to 500 MB each) and that the app login can write to it.

---

## 3. Website (static, Plesk)

1. API address:
   - If the API is on its own domain, copy `web/.env.production.example` to `web/.env.production` and set `VITE_API_BASE_URL=https://api.example.com/api/v1`.
   - If Plesk proxies `/api` on the website's own domain, leave it unset.
2. Build:
   ```bash
   cd web && npm ci && npm run build
   ```
3. Upload **the contents** of `web/dist/` to the domain's document root (`httpdocs`). `dist/` already contains:
   - `.htaccess` (Apache/Linux Plesk)
   - `web.config` (IIS/Windows Plesk; needs the IIS URL Rewrite module)

   These send every page link to the app, leave `/api/` alone, and set caching and security headers.
4. Turn on SSL/TLS + HTTPS redirect + HSTS for the domain.
5. Check the rewrite: open `https://learn.example.com/courses/<a-real-slug>` **directly** and press refresh. The page must load, not a 404. Do the same for `/account/delete-info`, `/privacy` and `/terms`.
6. Set `WEB_ORIGIN` in the API to this exact address and restart the API.

The same checks are automated locally: `cd web && npm run e2e`.

---

## 4. Mobile app

### Android signing (once)
1. Create the upload key and keep it safe. **Losing it means you can't update the app.**
   ```bash
   keytool -genkey -v -keystore lms-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Create `mobile/android/key.properties` (git-ignored, never commit):
   ```properties
   storePassword=<password>
   keyPassword=<password>
   keyAlias=upload
   storeFile=C:/secure/lms-upload.jks
   ```
   Without this file, release builds are signed with the debug key and Gradle prints a warning. Google Play rejects those.
3. Choose the final `applicationId` in `mobile/android/app/build.gradle.kts` (currently `com.lms.lms_app`) **before the first upload**. It can never change afterwards.
4. In Play Console, enable **Play App Signing**.

### Build
```bash
cd mobile
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols \
  --dart-define=API_BASE_URL=https://api.example.com/api/v1
```
- Upload `build/app/outputs/bundle/release/app-release.aab`.
- Keep `build/symbols/` for this version. Crash stack traces can only be read with it.
- Bump `version:` in `mobile/pubspec.yaml` (e.g. `1.0.1+2`) for every upload.

### iOS
```bash
flutter build ipa --release --obfuscate --split-debug-info=build/symbols \
  --dart-define=API_BASE_URL=https://api.example.com/api/v1
```
Needs a Mac with Xcode, an Apple Developer account, the bundle id and the signing team set in Xcode. Upload with Transporter or Xcode Organizer.

### Store listing notes
- **Privacy policy URL:** `https://learn.example.com/privacy`
- **Account deletion URL:** `https://learn.example.com/account/delete-info`. In-app deletion: More → Account → Delete account.
- **Data safety form:**
  - Collected: name, phone number, email (optional), city (optional), education, app activity (lesson progress, exam answers).
  - Purpose: app functionality and account management.
  - Data is encrypted in transit. Users can request deletion.
  - Declare that **downloaded videos are stored on the device, encrypted**.
  - No data is sold. No ads.
- **Permissions:** internet, network state. No camera, location or contacts.

---

## 5. Smoke test (staging, then production)

Use real phones on mobile data. Tick each one:
1. `GET /api/v1/health` → `"db": "up"`.
2. Admin logs in with OTP (a real SMS arrives).
3. A teacher applies on `/become-teacher`, the admin accepts, and the teacher logs in.
4. The teacher builds a course (thumbnail, 2 demo videos, one lesson of each type), adds a batch and publishes.
5. A visitor books a live demo. The teacher schedules it and sends it on WhatsApp, and the message arrives with the Meet link.
6. A student registers, enrolls, the teacher approves, and the student opens lessons and takes an exam (let one exam time out to check auto-submit) and sees the result.
7. The admin blocks the teacher. The student sees read-only access and the teacher can't log in.
8. Refresh a deep link (`/courses/<slug>`) and a signed-in page (`/student/exams`). Neither 404s nor logs out.
9. Android app:
   - Log in, download a lesson video on Wi-Fi, turn on airplane mode and play it.
   - A screenshot of the player is black.
   - The file isn't visible in the Files app.
   - Log out, and the download is gone.
10. Restore-test the backup (section 1).
