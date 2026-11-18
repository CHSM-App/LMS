# Release Checklist (v1)

Status as of **2026-11-18** (end of Phase 10, after the phase-by-phase review). Legend:
- ✅ done, with evidence
- ⏳ needs the owner, a provider approval or the staging server
- ⚠️ known gap, decided and documented

Deployment steps: [DEPLOY.md](DEPLOY.md). Services and approvals: [BACKEND_NEEDS.md](BACKEND_NEEDS.md).

## 1. Tests and builds
| | Item | Status / evidence |
|---|---|---|
| ✅ | API tests | `cd api && npm test` → 217/217 (27 suites), including the route × role matrix, security-log, IST end-of-day and two-tab exam tests |
| ✅ | Website unit tests | `cd web && npm test` → 44/44 |
| ✅ | End-to-end (Playwright) | `cd web && npm run e2e` → **23/23** (twice) on the built `dist/`. Every phase's "manual run" is automated: teacher apply/accept/reject→reapply, block a live session, subscriptions + audit log, course builder, Excel import + exam builder validation, operations (approve, class, attendance, doubt), Marathi search + demo videos, student journey (UT1/UT2 → Final, offline sync, resume, auto-submit, weighted final), blocked-teacher read-only, deep links (desktop + phone), 360 px Marathi layout, keyboard focus |
| ✅ | Flutter tests + analyze | `cd mobile && flutter analyze && flutter test` → no issues, 58/58 |
| ⏳ | Flutter on-device test | `integration_test/student_flow_test.dart` (OTP login, encrypted download, unit test result) compiles; run it on a phone/emulator against `api/scripts/e2e-server.js` (instructions in the file). This PC has no hypervisor for the emulator. |
| ✅ | Design-token tests | `cd design-tokens && npm test` → 25/25 (palette lock, contrast, raw-colour guard) |
| ✅ | Website production build | `npm run build` ok; `dist/` contains `.htaccess` + `web.config` |
| ✅ | Android release build | `flutter build apk --release --obfuscate --split-debug-info=build/symbols` ok (53 MB); the manifest has INTERNET, a loopback-only cleartext rule and `allowBackup=false` |
| ⏳ | Android **signed** bundle | Needs the upload key in `android/key.properties` (DEPLOY.md §4). Without it, the build uses the debug key and warns. |
| ⏳ | iOS build | Needs a Mac with Xcode and an Apple Developer account |
| ⏳ | Smoke test on staging (all 6 flows + phone checks) | DEPLOY.md §5 |

## 2. Security (guidelines/SECURITY.md)
| | Section | Status / evidence |
|---|---|---|
| ✅ | §1 OTP: `crypto.randomInt`, HMAC-hashed, 5 min, 3 sends / 15 min, 5 attempts, per-IP + per-mobile limits | `otp.service.js`; auth tests. A provider outage → 503, not counted toward the limit (Phase 10 test). |
| ✅ | §2 Sessions: 15 min JWT, 30-day hashed rotating refresh token, reuse → all sessions revoked, HttpOnly/Secure/SameSite=Strict cookie, memory-only access token on web, secure storage on mobile | Auth tests. **Phase 10 fix:** a lost refresh response (reload mid-refresh) no longer logs the user out: 20 s grace while the replacement is unused; theft detection unchanged (tests). |
| ✅ | §3 Authorization: deny by default, status re-read, ownership 404s, admin never touches content | **Phase 10 fix:** auth now runs *before* request validation (114 routes used to answer 400 to anonymous callers). `roleMatrix.test.js` checks every mounted route → 401 without login, 403 for wrong roles. |
| ✅ | §4 Privacy: serializers, masked mobiles, public ids, consents, account deletion, change mobile | Phase 3/8/9 tests; public deletion page `/account/delete-info` |
| ✅ | §5 Input: OpenAPI validation, parameterized SQL, server-side sanitizing, no `dangerouslySetInnerHTML` | grep: no `dangerouslySetInnerHTML` in `web/src`; contract test |
| ✅ | §6 Uploads: magic bytes, size limits, random names outside the web root, 10-minute signed links | Phase 5 upload tests |
| ✅ | §6b Offline video: licence, AES-256-CTR at rest, key in secure storage, loopback decryption, 7-day licence, renew/revoke, no share, FLAG_SECURE (Android) | Flutter tests (encrypted store, loopback server, licence guard, download VM, no-share widget test); API download tests |
| ⚠️ | §6b iOS screen-capture blanking | **Not built.** Android blocks screenshots; iOS doesn't yet. Decide before the iOS release. |
| ✅ | §7 Network: Helmet (CSP, frame-deny, nosniff, HSTS header), CORS = `WEB_ORIGIN`, rate limits 5/min auth + 300/15 min, 1 MB JSON | `app.js`, `rateLimits.js`. HTTPS + HSTS on the domains is a hosting setting (DEPLOY.md). |
| ⏳ | §7 Website security headers | `.htaccess` / `web.config` set nosniff, frame-deny, referrer and permissions policy. A **CSP for the website** isn't set yet: add it on staging once the YouTube/Vimeo/Bunny embed domains are final. |
| ✅ | §8 Errors and logging: no stack traces in production, masked logs, append-only audit log, security events logged | **Phase 10:** `otp_failed`, `token_reuse`, `forbidden` and `server_error` are logged as JSON without OTPs, tokens or full mobiles (`securityLog.test.js`) |
| ⏳ | §8/§9 Audit log append-only on the remote DB | A DBA must run `api/scripts/sql/setup-lms-app-role.sql` and add the app login to `lms_app` |
| ✅ | §9 DB: parameterized, named constraints, `encrypt: true` | Migrations + migrate test |
| ⏳ | §9 Daily backups + tested restore | Set up on the server; restore test recorded (DEPLOY.md §1) |
| ✅ | §10 Secrets: only `.env.example` files are committed; no secrets in web/Flutter builds | `git ls-files` shows only `api/.env.example`, `web/.env.production.example`; grep of `web/src`, `mobile/lib` is clean |
| ✅ | §11 Exams: server timer, answers hidden until submit, frozen paper, limits enforced server-side | Phase 6/9 tests; Flutter resume uses the server deadline |
| ✅ | §12 Mobile: obfuscated release with split debug info; single in-flight refresh | Release build above; `auth_test.dart` |
| ⏳ | `/security-review` on the whole repo | A **self-review** was done on 2026-11-18 (SQL parameters, file keys, signed links, video/link URLs, auth order, logging): no open findings. The `/security-review` command needs a git remote (`origin`), so run it once the repo is pushed, then fix or accept each finding. |

## 3. Dependencies
| | Item | Status / evidence |
|---|---|---|
| ✅ | No high/critical issues in code that **ships** | API production deps: 0 high/critical. Website production deps: 0 high/critical. |
| ⚠️ | Moderate issues in shipped deps (need major upgrades) | API: `exceljs`, `file-type`, `uuid`. Website: `react-router` 6. Plan a dependency-upgrade pass after launch, with the full test suites as the safety net. |
| ⚠️ | High/critical in **dev-only** tools | `vitest` / `vite` / `esbuild` (dev server and test runner; not in the build output). Upgrade with the pass above. |
| ✅ | `flutter pub outdated` reviewed | Only major updates are available (Riverpod 3, go_router 18); deliberately held for after launch |

## 4. Stores and providers
| | Item | Status |
|---|---|---|
| ⏳ | Google Play: Data safety form (declare the encrypted on-device video storage), privacy URL, **deletion URL `/account/delete-info`** (built), in-app deletion (built), permissions only INTERNET + network state | Owner, in Play Console |
| ⏳ | WhatsApp: Meta Business verified; 4 templates approved (`demo_scheduled`, `live_class`, `enrollment_approved`, `subscription_reminder`) in en/mr/hi; `wa.me` fallback tested | The fallback is covered by tests; approvals by the owner |
| ⏳ | SMS: DLT entity + sender ID + OTP template; MSG91 template id | Owner |
| ⏳ | Google Workspace service account (or stay on manual Meet links) | Owner |
| ⏳ | Terms + Privacy reviewed and published in en/mr/hi; `POLICY_VERSION` bumped | Owner / legal |

## 5. Offline video on real phones
| | Item | Status |
|---|---|---|
| ⏳ | Download on Wi-Fi → airplane mode → plays | Real Android phone (no device was available during the build) |
| ⏳ | Screenshot / screen recording is black | Real Android phone |
| ⏳ | File not visible in the Files app / gallery | Real Android phone |
| ⏳ | Licence expiry → locks; back online → renews or is removed with the reason | Real phone + staging (set the licence expiry in the past) |
| ⚠️ | Downloads continue in the background | Not supported in v1: downloads pause if the app is closed (resume continues from where they stopped) |

## 6. Translations and brand
| | Item | Status / evidence |
|---|---|---|
| ✅ | Website: en/mr/hi key parity | `i18n.test.js` |
| ✅ | App: en/mr/hi ARB key parity | 207 / 207 / 207 keys, none missing |
| ⏳ | Marathi/Hindi wording reviewed by a native speaker | Owner |
| ✅ | No raw colours; contrast tests | `node scripts/check-no-raw-colors.js` passes; design-token contrast tests |
| ✅ | 360 dp Marathi layout | Flutter test: dashboard with a long Marathi name, no overflow |

## Phase done when
- [ ] Website + API deployed to staging; the Android build installed on a real phone; every role's flow works (§1 smoke test, §5)
- [ ] Every ⏳ above is closed and every ⚠️ is accepted by the owner
