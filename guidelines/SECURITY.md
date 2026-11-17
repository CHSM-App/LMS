# Security Practices

Every phase must follow these rules. Each phase file in `phases/` lists the security tests it adds.
They cover the OWASP Top 10 and the OWASP API Security Top 10. The three main risks for this project are:
- **Broken object-level authorization:** teacher A reads teacher B's data.
- **Broken authentication:** OTP abuse.
- **Excessive data exposure:** student mobile numbers leak.

## 1. Login (mobile + OTP)
- OTPs are 6 digits, generated with `crypto.randomInt`, never `Math.random`.
- OTPs are stored **hashed** (HMAC-SHA256 with a server secret), never in plain text.
- Expiry: **5 minutes**. An OTP is single-use and consumed as soon as it is verified.
- Resend limit: **3 per 15 minutes** per mobile + purpose.
- Verify-attempt limit: **5**. After that the OTP is dead and the user must request a new one.
- Rate limits are applied both per mobile number and per IP.
- Unknown and known numbers get the same "OTP sent" response, so no one can find out who is registered.

## 2. Sessions and tokens
- Access token: JWT, **15 minutes**, signed with HS256 using `JWT_ACCESS_SECRET`.
- Refresh token: random 48 bytes, **30 days**, stored **hashed** in `refresh_tokens`, and **rotated on every use**.
- Reusing an already-rotated refresh token revokes the whole token family (theft detection).
- Web: the refresh token lives in an `HttpOnly; Secure; SameSite=Strict` cookie. The access token is kept in memory only and never in localStorage.
- Mobile: tokens are stored in `flutter_secure_storage` only.
- Blocking a user or changing their role or status revokes all of their refresh tokens immediately.

## 3. Authorization
- `authenticate` and `authorize(...roles)` run on **every** non-public route. The default is deny.
- The role and status are re-read from the DB on each request (cached for at most 60 seconds), so blocks take effect quickly.
- **Ownership checks:** every teacher query includes `teacher_id = @me`. Every student query checks for an enrollment plus an active subscription.
- Admin never touches course content or exams (spec §3.2).
- Blocked teacher: their students get read-only access to completed content only (spec §6).
- `guidelines/ROLES.md` (written in Phase 1) is the permission matrix. A test checks every route against every role.

## 4. Privacy
- A student's mobile number is never returned to another student (spec §6).
- Responses use explicit serializers that list allowed fields; whole DB rows are never returned.
- Mobile numbers are masked (`98XXXXXX21`) for anyone other than the owner, their teacher or the admin.
- Public URLs use `public_id` (UNIQUEIDENTIFIER), never the INT primary key.

- **Consent:** registration and demo forms store `legal_consents` (type, policy version, time, IP). WhatsApp messages only go to users with `whatsapp_opt_in = 1`.
- **Account deletion:**
  - Requires OTP re-confirmation.
  - Anonymises name, mobile, email, photo and profile text (`name = 'Deleted user'`, `mobile = 'del-<id>'`) and sets `deleted_at`.
  - Revokes every token.
  - Exam/attendance rows stay for the teacher's records, without personal data.
- **Change mobile:** OTP on the new number while logged in, then all other sessions are revoked. A change made by the admin is audit logged and notifies the user on both numbers.

## 5. Input and injection
- Every request is validated against `docs/openapi.yaml` (express-openapi-validator). Unknown fields are rejected.
- SQL uses parameterized, typed `mssql` inputs only. Sort and filter columns come from allowlists (see `mssql.md`).
- XSS: React escapes output and `dangerouslySetInnerHTML` is never used. Rich text is sanitized with DOMPurify on the server before it is saved.
- Mobile numbers are normalized to `+91XXXXXXXXXX` before use.

## 6. File uploads
- Allowed types are checked by magic bytes, not the extension: mp4, pdf, jpg/png/webp, xlsx.
- Size limits: image 5 MB, PDF 20 MB, xlsx 5 MB, video 500 MB.
- Files are saved under random names outside the web root.
- Protected files are served through the API after an access check, using signed links that expire in 10 minutes. Demo videos are public.
- Excel import reads values only, with no formulas or macros, and a 2,000-row maximum. Exports escape cells that start with `= + - @`.

## 6b. Offline video downloads (mobile app only)
- A download needs a **licence** from `POST /student/contents/:id/download`. It is issued only for an active enrollment, an uploaded video and a registered device (max 2 per student).
- The file is fetched from a signed URL that expires in 10 minutes. The app **encrypts it at rest** with AES-256-CTR, using a per-device, per-content key the server sends with the licence. The key lives in `flutter_secure_storage` only, never next to the file.
- Playback decrypts on the fly through a local loopback stream. No decrypted copy is ever written to disk.
- The licence lasts 7 days offline (and never past the subscription end) and renews when online. When it expires or is revoked, the key and file are deleted.
- No share, export or "open with" actions. Screenshots and screen recording are blocked on the player (`FLAG_SECURE` on Android; on iOS the player is blanked during capture).
- Every licence, renewal and revocation is stored in `offline_downloads` so it can be audited.

## 7. Network and server
- HTTPS only, with HSTS.
- Helmet headers (CSP, frame-deny, nosniff, referrer policy). `x-powered-by` is turned off.
- CORS allows only `WEB_ORIGIN`.
- Rate limits: 5 requests/minute/IP on `/auth/*` and 300 requests/15 minutes/IP on the rest of the API.
- JSON body limit is 1 MB. Uploads have their own limits (section 6).

## 8. Errors and logging
- Production errors return `{ success:false, error:"<plain message>" }` with no stack trace or SQL text.
- Logs never contain OTPs, tokens or full mobile numbers (masked).
- `admin_audit_log` records every admin action (who, what, before, after, IP, time). It is append-only: the DB user has no UPDATE or DELETE permission on it.
- Security events are logged: failed OTPs, revoked token reuse and 403s.

## 9. Database
- The app connects as a low-privilege user `lms_app` (data read/write only, no DDL). Migrations run as a separate user.
- The connection uses `encrypt: true`.
- Named CHECK, FK and DEFAULT constraints. Exam questions are archived, never hard-deleted.
- Daily backups, with a restore tested before go-live.

## 10. Secrets
- `.env` is never committed; only `.env.example` with blank values is.
- Development and production use different secrets.
- No secrets go in the web or Flutter builds.

## 11. Exams
- The timer runs on the server: `deadline = started_at + duration`. The client clock is ignored.
- Mock mode: correct answers are never sent before the attempt is submitted.
- Each student's random question set is frozen when the attempt starts.
- Attempt limits, start/end dates and late submissions are enforced on the server.

## 12. Mobile
- Release builds use `--obfuscate --split-debug-info`, with logging off.
- Fix `Flutter_ARCHITECTURE.md` §14.1–14.5 and §14.8. A single in-flight token refresh handles concurrent 401s (§14.3).

## 13. Dependencies
- Lock files are committed. `npm audit` and `flutter pub outdated` run each phase.
- Run `/security-review` before closing each phase.
