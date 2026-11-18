# Phase 10: Notifications, Flutter Parity, Tests, Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Finish notifications for every role and channel.
- Bring the Flutter app to parity with the website.
- Close the test gaps.
- Ship: a static web build for Plesk, the API deployment, and Android/iOS builds.

**Architecture:**
- The Flutter app follows `guidelines/Flutter_ARCHITECTURE.md` §1–13, with the §14 fixes and §15 upgrades applied. Screens are grouped by role, and it calls the same API through Retrofit.
- The web app is a static `dist/` with an SPA rewrite.
- The API runs as a Node app (Plesk Node.js extension or a VPS with PM2) against SQL Server.

**Tech Stack:** Flutter (Riverpod, Dio/Retrofit, freezed, go_router, video_player/chewie, syncfusion_flutter_pdfviewer or pdfx, url_launcher); Playwright for web end-to-end tests.

**Spec:** spec §7 Notifications, §8 Backend note, §9 Phase 10. `guidelines/Flutter_ARCHITECTURE.md` §16–17.

## Global Constraints
- In-app notifications for all roles. **WhatsApp for Meet links. SMS or WhatsApp for OTP.**
- Statuses everywhere: Pending, Approved, Rejected, Blocked.
- One common website + mobile app, with the same features for each role.
- Hosting for the web is static (Plesk). `BACKEND_NEEDS.md` lists every backend service.
- Languages: en, mr, hi on web and mobile.

## Review Focus
1. **Opening a deep link** (e.g. `/courses/:slug` or a notification link) **directly on Plesk** must not give a 404. Task 3 (rewrite rules) + an end-to-end test.
2. **An app is killed mid-exam and reopened:** it resumes the same attempt with the server's remaining time. Task 2 Flutter test.
3. **An SMS/WhatsApp provider outage:** OTP send returns 503 "Couldn't send OTP. Try again shortly", and nothing is half-created. Task 1.
4. **Notifications for a blocked user** are not delivered over WhatsApp, but stay in-app. Task 1.
5. **A Marathi UI with a long teacher name** on a small Android screen (360 dp) doesn't overflow. Task 2 golden test.

## File Structure
```
api/src/providers/otp/msg91.js, whatsapp/metaCloud.js, meet/google.js (real implementations, env-switched)
api/src/services/notification.service.js (extend: channels + templates)
api/tests/integration/notifications/*.test.js
web/e2e/*.spec.js (Playwright), web/public/{.htaccess, web.config}
mobile/lib/screens/{admin,teacher,public,student}/**, mobile/lib/data/api/api_service.dart (all endpoints)
mobile/test/**, mobile/integration_test/**
docs/DEPLOY.md, docs/BACKEND_NEEDS.md (final)
```

---

### Task 1: Notification channels + real providers

**Interfaces:** Extend `notify(userId, { title, message, link, channels:['in_app','whatsapp'?] })`. `in_app` is always written. WhatsApp is skipped for blocked users and only sent where the spec says (Meet links). The real providers are switched on by `OTP_PROVIDER`, `WHATSAPP_PROVIDER` and `MEET_PROVIDER`.

- [x] **Step 1:** Write the failing tests:
  - An event matrix (teacher request created, accepted/rejected, blocked, subscription set, **subscription expiring in 7 days**, demo scheduled, enrollment approved/rejected, **batch changed**, live class created + reminder **(batch-targeted)**, doubt answered, exam published, **mobile changed**) → the right recipients get the right i18n message in their `preferred_lang`.
  - WhatsApp is sent only when `whatsapp_opt_in = 1`.
  - When the OTP provider throws → 503 with that message, and the OTP row is marked unsent so it doesn't count toward the resend limit.
  - A blocked user gets in-app only.
  - The real providers are tested with mocked HTTP (nock): the right URL, auth header and template id.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat: notification channels and real providers`.

### Task 2: Flutter app (scope per DECISIONS.md)

**Scope:** a full student app + a light teacher app. **Not in the app:** the course builder, question bank, exam builder, results admin and the whole Super Admin app (website only). Those screens show "Open on website" with a link.

Build in this order. Each feature gets a ViewModel test, a repository test with a mocked ApiService, and a widget test (§16):
1. Auth + splash role gate + account (change mobile, delete account, consent). Done in Phase 3; re-check against the final API. An **admin** logging in on the app sees "Use the website for admin tasks".
2. Public: course list/search, course details with demo video (`VideoFrame` for upload/YouTube/Vimeo/Bunny), live demo form with consent.
3. Student: registration/enroll, dashboard (with batch), player (video + mark complete), notes viewer, **exam screen** (server deadline, autosave with in-memory retry, resume after an app restart; ⏸️ no sqflite outbox), results/review, doubts, progress, profile, notifications.
4. Light teacher: built in Phase 7 Task 7. Re-check it here against the final API.
5. **Student offline video downloads** (DECISIONS.md "Offline video download rules"; API in Phase 9 Task 6b). See Task 2b.

### Task 2b: Offline video downloads (student app)

**Packages:**
- `background_downloader`: background download with pause/resume, Wi-Fi-only option
- `cryptography` or `pointycastle`: AES-256-CTR
- `flutter_secure_storage`: keys
- `video_player`: playback through a local loopback decrypting stream (`shelf` on 127.0.0.1, random port, random path token)
- `screen_protector`: Android FLAG_SECURE, iOS capture blanking
- `device_info_plus` + `uuid`: stable device id

**Structure** (per Flutter_ARCHITECTURE.md):
- `data/local/download_dao.dart` (sqflite table `downloads`: content_id, course_id, title, size, status, file_path, key_id, license_expires_at, progress)
- `data/repositories/download_impl.dart`
- `domain/usecase/download_usecase.dart`
- `presentation/viewModels/download_viewmodel.dart`
- `core/offline/{encrypted_store, decrypt_stream_server, license_guard}.dart`
- `screens/student/downloads/{downloads_screen, storage_bar}.dart`
- A download button on the player and the module list

**Rules:**
- The file is downloaded to a temp file, encrypted chunk by chunk into `getApplicationSupportDirectory()/offline/<uuid>.bin`, and then the temp file is deleted at once.
- The file is never stored in Downloads, the gallery or external storage.
- **No share, export or open-with action anywhere** in the app.
- Opening an offline video checks `license_expires_at > now`. When it has expired: "Connect to the internet to keep watching offline".
- On app start and on every online event: call `/student/downloads/renew`, and delete the files + keys of anything revoked. Show what was removed and why ("Removed: subscription ended").
- Offline watch position and completion are queued in sqflite (a small table, separate from the greyed-out exam queue) and sent via `/student/progress/sync` when online.

- [x] **Step 1:** Write the failing tests:
  - `EncryptedStore`: an encrypt → decrypt round trip of a 10 MB file is byte-identical. Seeking to offset X decrypts the right bytes (CTR). The stored file never contains the plain bytes (the first 1 KB doesn't match).
  - `LicenseGuard`: expired → locked. Renew revoked → the file and the key are both deleted.
  - `DownloadViewModel`: queued → downloading (progress %) → paused → resumed → completed. A Wi-Fi-only setting on mobile data → waits with the message "Waiting for Wi-Fi". Low storage (< size + 200 MB) → the message "Not enough space. Free up {n} MB".
  - Third device → shows the device-limit message with a link to Profile → Downloads.
  - Logout → every offline file and key is deleted.
  - Widget tests: the download button is hidden for link (YouTube/Vimeo/Bunny) videos, and there is no share icon on the player or the Downloads screen.
  - Offline progress queue syncs once online, without duplicates.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Implement.
  - **Downloads screen:** list grouped by course (title, size, status, licence expiry), per-item pause/resume/delete, "Delete all", total storage bar, Wi-Fi-only toggle, and the registered devices list with Remove.
  - **Player:** a "Downloaded ✓" or download progress chip, and offline playback.
- [ ] **Step 4:** Run `flutter test`, then check by hand on a real Android phone: — `flutter test` ✅ 58/58; **phone checks pending (owner)** — no device or emulator on the build PC (no hypervisor). See docs/RELEASE-CHECKLIST.md §5.
  - Download on Wi-Fi.
  - Airplane mode → the video plays.
  - A screenshot comes out black.
  - The file isn't visible in the file manager.
  - Expire the licence (set the server date or expiry to the past) → the video locks.
  - Go online → it renews or is removed.
- [x] **Step 5:** Commit `feat(mobile): offline video downloads (encrypted, no sharing)`.

- [x] **Step 1:** For each feature, write the failing tests. Key ones:
  - Exam resume after an app restart uses `deadlineAt` from the server.
  - An unsent answer is retried in memory with exponential backoff (§15.11), and the screen shows "Offline — answers will sync".
  - A 360 dp golden test in `mr` shows no overflow.
  - The role gate sends a student away from teacher routes.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run `flutter test`, then `flutter test integration_test` on an emulator. **Step 5:** Commit per feature: `feat(mobile): <feature>`. — Steps 2–3, 5 ✅ and `flutter test` ✅; `integration_test/student_flow_test.dart` written and compiles, **run pending on a device** (instructions in the file).

### Task 3: End-to-end tests + web release build

- [x] **Step 1:** Write the Playwright specs (seeded DB + console providers):
  - `admin-approves-teacher`
  - `teacher-builds-and-publishes-course`
  - `public-demo-request-to-whatsapp`
  - `student-enroll-learn-exam-result`
  - `blocked-teacher-read-only`
  - `deep-link-refresh` (for each route, reload the page → no 404)
- [x] **Step 2:** Run them and fix any failures.
- [x] **Step 3:** Add `web/public/.htaccess` (Apache: rewrite everything that isn't a file to `/index.html`) and `web/public/web.config` (IIS: a URL Rewrite rule doing the same). `VITE_API_BASE_URL` comes from `.env.production`.
- [x] **Step 4:** `npm run build` → `dist/`. Serve `dist/` locally with a static server and re-run the deep-link spec against it.
- [x] **Step 5:** Commit `chore(web): e2e suite and Plesk static build`.

### Task 4: API deploy + mobile builds + docs

- [x] **Step 1:** Write `docs/DEPLOY.md`:
  - **API:** Plesk Node.js app (or a VPS + PM2), with `NODE_ENV=production`, the env vars, `npm ci --omit=dev`, `npm run migrate` run as the migration user, an `lms_app` login with data-only permissions, HTTPS, CORS set to the web domain, `STORAGE_DIR` outside the web root, log rotation, and a daily DB backup job plus a tested restore.
  - **Web:** upload `dist/` to the Plesk document root and confirm the rewrite works.
  - **Mobile:**
    - `flutter build appbundle --release --obfuscate --split-debug-info=build/symbols --dart-define=API_BASE_URL=...`
    - `flutter build ipa` with the same flags.
    - Signing steps and store listing notes.
- [x] **Step 2:** Finalize `docs/BACKEND_NEEDS.md`: every provider, its account and approval requirements (DLT for SMS, the WhatsApp template), and rough monthly costs to confirm.
- [x] **Step 3:** Run the release checklist (status per item: `docs/RELEASE-CHECKLIST.md`):
  - [ ] `npm audit` (api + web) has no high/critical issues. `flutter pub outdated` has been reviewed.
  - [ ] `/security-review` has run on the whole repo, and every finding is fixed or explicitly accepted.
  - [ ] Every item in `guidelines/SECURITY.md` has been checked off.
  - [x] All API, web, Flutter and Playwright suites are green.
  - [ ] A smoke test on a staging server passes, covering all 6 end-to-end flows.
  - [ ] **Google Play compliance:** the Data safety form is filled; the account deletion URL (`/account/delete-info`) and privacy policy URL are live; in-app deletion works; there are no unused permissions.
  - [ ] **WhatsApp:** the Meta Business account is verified, the templates (demo scheduled, live class, enrollment approved, subscription reminder) are approved, and the `wa.me` fallback is tested.
  - [ ] **SMS:** DLT entity + OTP template registered.
  - [ ] **Offline video:** the airplane-mode playback, screenshot-blocked, no-share and licence-expiry checks pass on Android and iOS. The Data safety form declares the local encrypted storage.
  - [x] Marathi + Hindi translations are complete (no missing keys: `i18next-parser` check + an ARB key diff), and the brand has been checked on every screen of every role: the no-raw-colours check and the contrast tests pass.
- [x] **Step 4:** Commit `docs: deployment guide and release checklist`.

## Phase done when
- [ ] The website (static) and the API are deployed to staging. The Android build is installed on a real phone and every role's flow works.
- [ ] The release checklist is fully ticked.
