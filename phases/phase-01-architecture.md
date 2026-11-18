# Phase 1: Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo, a working API skeleton with a DB connection, the full ERD, the core migration, the OpenAPI contract, the roles matrix, the i18n skeletons and BACKEND_NEEDS.md.

**Architecture:** One repo with `api/` (Express, CommonJS, mssql), `web/` (React + Vite, JS), `mobile/` (Flutter) and `docs/`. The API is layered: route → middleware → controller → service → repository. `docs/openapi.yaml` is the contract, and the API validates against it.

**Tech Stack:** Node 22, express 4, mssql, helmet, cors, morgan, express-rate-limit, express-openapi-validator, jsonwebtoken, dotenv, jest, supertest; Vite + React 18; Flutter stable.

**Spec:** `guidelines/lms-full-build-prompt.md` §1, §8, §9 (Phase 1). Guides: `guidelines/express.md`, `guidelines/mssql.md`, `guidelines/FOLDER_STRUCTURE.md`, `guidelines/SECURITY.md`. **Decisions:** `guidelines/DECISIONS.md` (wins over the spec where they differ).

## Global Constraints
- Three roles only: Super Admin, Teacher, Student. All logins use mobile + OTP, with no passwords.
- No online payment. A "subscription" is an access period: start date, end date and status.
- Statuses used everywhere: Pending, Approved, Rejected, Blocked.
- Hosting for the web is static (Plesk). The API is separate.
- DB rules: NVARCHAR for human text, `DATETIME2(3)` UTC, named constraints, an index on every FK, idempotent migrations.

## Review Focus
1. **Running the migration twice:** the second run must not error and must not change anything. Covered by the test in Task 3.
2. **Marathi/Hindi text saves without becoming `?`.** Covered by the Task 3 Unicode round-trip test.
3. **The DB is down when the API starts:** the server must log a clear error and `/health` returns 503, not crash. Task 2.
4. **An unknown route returns JSON 404**, not Express's HTML page. Task 2.
5. **A request that doesn't match OpenAPI returns 400 `{success:false}`**, not 500. Task 5.

## File Structure
```
.gitignore, CLAUDE.md (exists), README.md
api/package.json, api/.env.example, api/jest.config.js
api/src/app.js, api/src/server.js
api/src/config/env.js
api/src/db/pool.js, api/src/db/tx.js
api/src/middlewares/errorHandler.js, notFound.js, rateLimits.js, validate.js
api/src/utils/APIError.js, mobile.js, paginate.js
api/src/routes/index.js, health.routes.js
api/migrations/001_core.sql
api/scripts/migrate.js
api/tests/setup/testDb.js
api/tests/integration/health.test.js, migrate.test.js, openapi.test.js
api/tests/unit/mobile.test.js, paginate.test.js
docs/ERD.md, docs/openapi.yaml, docs/ROLES.md, docs/BACKEND_NEEDS.md
web/ (Vite scaffold), web/src/i18n/{en,mr,hi}.json, web/src/i18n/index.js
mobile/ (flutter create), mobile/lib/l10n/{app_en,app_mr,app_hi}.arb, mobile/l10n.yaml
```

---

### Task 1: Repo + API project skeleton

**Files:** Create `.gitignore`, `README.md`, `api/package.json`, `api/.env.example`, `api/jest.config.js`, `api/src/config/env.js`

**Interfaces:**
- Produces: `config` object with `{ port, nodeEnv, db:{server,database,user,password,encrypt}, jwt:{accessSecret, refreshSecret}, otpSecret, webOrigin }`. It throws on start-up if a required key is missing.

- [x] **Step 1:** `git init`. Add a `.gitignore` covering `node_modules/`, `.env`, `dist/`, `uploads/`, `build/`, `.dart_tool/` and `coverage/`.
- [x] **Step 2:** `cd api && npm init -y`, then install the dependencies listed in Tech Stack. Scripts: `dev` (node --watch src/server.js), `start`, `test` (jest --runInBand), `migrate` (node scripts/migrate.js), `seed`.
- [x] **Step 3:** Write `.env.example` with these keys and blank values: `PORT, NODE_ENV, DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, DB_ENCRYPT, DB_TEST_NAME, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OTP_SECRET, WEB_ORIGIN, OTP_PROVIDER, WHATSAPP_PROVIDER, MEET_PROVIDER, STORAGE_DIR`.
- [x] **Step 4:** Write the failing test `tests/unit/env.test.js`: `loadConfig({})` throws `Missing env: DB_SERVER`.
- [x] **Step 5:** Implement `loadConfig(env = process.env) -> config` in `src/config/env.js`.
- [x] **Step 6:** Run `npm test -- env`. Expected: PASS.
- [x] **Step 7:** Commit `chore: init repo and api skeleton`.

### Task 2: Express app, errors, health

**Files:** Create `src/app.js`, `src/server.js`, `src/utils/APIError.js`, `src/middlewares/{errorHandler,notFound,rateLimits}.js`, `src/routes/{index,health.routes}.js`, `src/db/pool.js`, `src/db/tx.js`. Test: `tests/integration/health.test.js`

**Interfaces:**
- Produces: `createApp({ pool }) -> express.Application`, `class APIError(status:number, message:string, code?:string)`, `getPool() -> Promise<ConnectionPool>`, `withTransaction(async (tx) => ...)`, `apiLimiter`, `authLimiter`.

- [x] **Step 1:** Write the failing tests:
  - `GET /api/v1/health` returns 200 `{ success:true, data:{ db:"up" } }`.
  - With a pool whose `request().query` throws, it returns 503 `{ success:false, error:"Database unavailable" }`.
  - `GET /api/v1/nope` returns 404 `{ success:false, error:"Not found" }`.
  - The `x-powered-by` header is absent.
- [x] **Step 2:** Run it and see it fail.
- [x] **Step 3:** Implement `createApp`. Order: `helmet()`, `cors({ origin: config.webOrigin, credentials:true })`, `express.json({ limit:'1mb' })`, morgan (dev only), `apiLimiter` (300 per 15 minutes), routes under `/api/v1`, `notFound`, `errorHandler`.
  - `errorHandler` hides `err.message` for 500s in production and adds `stack` only when `NODE_ENV=development` (express.md §4).
  - `withTransaction` uses `SET XACT_ABORT ON` semantics: begin, run fn, commit, and roll back on any throw.
- [x] **Step 4:** Run it and see it pass.
- [x] **Step 5:** Commit `feat(api): express app with health, errors, security headers`.

### Task 3: ERD + core migration + migrate script

**Files:** Create `docs/ERD.md`, `api/migrations/001_core.sql`, `api/scripts/migrate.js`, `api/tests/setup/testDb.js`. Test: `tests/integration/migrate.test.js`

**Interfaces:**
- Produces: `migrate({ database }) -> Promise<string[]>`, which returns the files it applied. It records applied files in `dbo.schema_migrations(file_name, applied_at)`.
- Produces: `resetTestDb()`, which drops and recreates `DB_TEST_NAME` and runs every migration.

- [x] **Step 1:** Write `docs/ERD.md` as a mermaid `erDiagram` with **all** tables for the whole project. The migration that creates each table is in brackets:
  - [001] `users`, `teacher_profiles`, `student_profiles`, `teacher_requests`, `teacher_subscriptions`, `otp_codes`, `refresh_tokens`, `notifications`, `admin_audit_log`, `legal_consents`, `mobile_change_requests`
  - [002] `courses`, `subjects`, `modules`, `contents`, `upload_sessions`, `batches`
  - [003] `questions`, `question_options`, `exams`, `exam_modules`, `exam_questions`, `exam_batches`, `exam_attempts`, `exam_attempt_questions`, `attempt_answers`
  - [004] `demo_requests`, `enrollments`, `student_subscriptions`, `live_classes`, `attendance`, `doubts`, `class_programs`
  - [005] `content_progress`, `student_devices`, `offline_downloads`
- [x] **Step 2:** Write the failing tests:
  - After `resetTestDb()`, `sys.tables` contains every 001 table.
  - Running `migrate()` a second time returns `[]`.
  - Inserting `N'सुरेश पाटील'` into `users.name` reads back the same string.
  - `SELECT COUNT(*) FROM sys.foreign_keys WHERE is_not_trusted=1` = 0.
- [x] **Step 3:** Run it and see it fail.
- [x] **Step 4:** Write `001_core.sql`. Every table has an `INT IDENTITY` clustered PK, named constraints and FK indexes. Key columns:
  - `users(user_id, public_id UNIQUEIDENTIFIER DEFAULT NEWID() UNIQUE, mobile VARCHAR(15) NOT NULL, name NVARCHAR(120), email VARCHAR(160) NULL, city NVARCHAR(80) NULL, photo_url VARCHAR(400) NULL, role VARCHAR(10) CHECK IN ('admin','teacher','student'), status VARCHAR(10) CHECK IN ('pending','approved','rejected','blocked'), preferred_lang CHAR(2) DEFAULT 'en', whatsapp_opt_in BIT DEFAULT 0, deleted_at DATETIME2 NULL, created_at, updated_at, row_ver ROWVERSION)`. The mobile unique index is filtered `WHERE deleted_at IS NULL`, so a deleted account's number can register again.
  - `legal_consents(consent_id, user_id FK NULL, mobile VARCHAR(15), consent_type VARCHAR(20) CHECK IN ('terms_privacy','whatsapp'), policy_version VARCHAR(10), consented_at, ip VARCHAR(45))`
  - `mobile_change_requests(request_id, user_id FK, old_mobile, new_mobile, status VARCHAR(10) CHECK IN ('pending','completed','cancelled'), changed_by FK users NULL /*admin*/, created_at, completed_at)`
  - `teacher_profiles(user_id PK/FK, subject NVARCHAR(120), experience_years TINYINT, qualification NVARCHAR(160), bio NVARCHAR(2000), intro_video_url, social_links_json NVARCHAR(1000), languages NVARCHAR(200), public_slug VARCHAR(80) UNIQUE)`
  - `student_profiles(user_id PK/FK, education NVARCHAR(120), class_standard NVARCHAR(40), city NVARCHAR(80))`
  - `teacher_requests(request_id, mobile, name, course_name, subject, experience_years, email, city, qualification, photo_url, id_document_url, status CHECK pending/approved/rejected, reject_reason NVARCHAR(500), reviewed_by FK users, reviewed_at, user_id FK NULL, created_at)` plus a filtered unique index on `(mobile) WHERE status='pending'`.
  - `teacher_subscriptions(subscription_id, teacher_id FK, plan_type VARCHAR(12) CHECK IN ('monthly','quarterly','half_yearly','yearly','custom'), start_date DATE, end_date DATE, status, reminder_sent_at NULL, CHECK end_date >= start_date)`
  - `otp_codes(otp_id, mobile, purpose VARCHAR(20) CHECK IN ('login','teacher_register','student_register','demo_request','change_mobile','delete_account'), code_hash VARBINARY(32), expires_at, attempts TINYINT DEFAULT 0, resend_count TINYINT DEFAULT 0, window_started_at, consumed_at NULL)` with an index on `(mobile, purpose, created_at DESC)`.
  - `refresh_tokens(token_id, user_id FK, family_id UNIQUEIDENTIFIER, token_hash VARBINARY(32) UNIQUE, expires_at, revoked_at NULL, replaced_by NULL)`
  - `notifications(notification_id, user_id FK, title NVARCHAR(160), message NVARCHAR(1000), link VARCHAR(300), is_read BIT DEFAULT 0, created_at)` with an index on `(user_id, is_read, created_at DESC)`.
  - `admin_audit_log(audit_id BIGINT, admin_id FK, action VARCHAR(40), entity_type VARCHAR(30), entity_id INT, before_json NVARCHAR(MAX), after_json NVARCHAR(MAX), ip VARCHAR(45), created_at)`
  - Each statement is wrapped in `IF NOT EXISTS`.
- [x] **Step 5:** Implement `migrate.js`. It reads `migrations/*.sql` in name order, skips files already in `schema_migrations`, splits on `GO` lines, and runs each file in a transaction.
- [x] **Step 6:** Run `npm test -- migrate`. Expected: PASS.
- [x] **Step 7:** Commit `feat(db): ERD and core migration`.

### Task 4: Shared utils

**Files:** Create `src/utils/mobile.js`, `src/utils/paginate.js`. Tests: `tests/unit/mobile.test.js`, `tests/unit/paginate.test.js`

**Interfaces:** Produces `normalizeMobile(input:string) -> string|null`, `maskMobile(m:string) -> string`, `paginate({page, limit}) -> { page, limit, offset }`.

- [x] **Step 1:** Write the failing tests:
  - `normalizeMobile('98765 43210')` → `'+919876543210'`
  - `normalizeMobile('+91-9876543210')` → `'+919876543210'`
  - `normalizeMobile('12345')` → `null`
  - `normalizeMobile('5876543210')` → `null` (Indian mobiles start with 6–9)
  - `maskMobile('+919876543210')` → `'98XXXXXX10'`
  - `paginate({})` → `{page:1, limit:20, offset:0}`
  - `paginate({page:'3', limit:'500'})` → `{page:3, limit:100, offset:200}` (limit is capped at 100)
  - `paginate({page:'-1'})` → `page:1`
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run and see it pass.
- [x] **Step 5:** Commit `feat(api): mobile and pagination utils`.

### Task 5: OpenAPI contract + validator

**Files:** Create `docs/openapi.yaml`, `src/middlewares/validate.js`. Test: `tests/integration/openapi.test.js`

**Interfaces:** Produces `validate`, which is express-openapi-validator configured with `apiSpec: docs/openapi.yaml`, `validateRequests: { allowUnknownQueryParameters:false }`, `validateResponses: nodeEnv !== 'production'`. Errors are mapped to 400 `{success:false, error}`.

- [x] **Step 1:** Write `openapi.yaml` (OpenAPI 3.0.3) with:
  - Shared components: `SuccessEnvelope`, `ErrorEnvelope`, `Pagination`, `Mobile` (pattern `^\+91[6-9]\d{9}$`), `Status` enum, `bearerAuth`.
  - **Every endpoint listed in phases 3–10**, with each one's tags (auth, admin, teacher, public, student) and request/response schemas. The endpoint tables in each phase file are the source.
- [x] **Step 2:** Write the failing tests:
  - The spec loads with `@apidevtools/swagger-parser` without errors.
  - `POST /api/v1/auth/otp/send` with `{mobile:"abc"}` returns 400 `{success:false}`.
- [x] **Step 3:** Run and see it fail. **Step 4:** Mount `validate` in `createApp` before the routes. **Step 5:** Run and see it pass.
- [x] **Step 6:** Commit `feat(api): OpenAPI contract and request validation`.

### Task 6: Roles matrix, i18n, BACKEND_NEEDS, web + mobile scaffolds

**Files:** Create `docs/ROLES.md`, `docs/BACKEND_NEEDS.md`, `web/` (Vite), `web/src/i18n/*`, `mobile/` (Flutter), `mobile/lib/l10n/*.arb`

- [x] **Step 1:** Write `docs/ROLES.md`, a table with one row per endpoint group and the columns `public | student | teacher (own only) | admin`. It follows spec §3.2: admin = teachers, subscriptions, notifications, audit only.
- [x] **Step 2:** Write `docs/BACKEND_NEEDS.md`:
  - SMS OTP provider (e.g. MSG91, DLT-registered template)
  - WhatsApp Business API (Meta Cloud API, approved template for the Meet link)
  - Google Calendar API with a Workspace account for Meet links (fallback: teacher pastes the link)
  - SQL Server hosting
  - Node hosting (Plesk Node.js extension or a VPS)
  - File/video storage (disk → S3-compatible later)
  - HTTPS certificates
  - SMTP (optional)
  - Privacy policy + terms text, legally reviewed for India's DPDP Act 2023
  - Support contact (email/WhatsApp number) shown on blocked/rejected screens
- [x] **Step 3:** `npm create vite@latest web -- --template react`. Install `react-router-dom @tanstack/react-query react-hook-form i18next react-i18next dompurify`, plus `vitest @testing-library/react jsdom` as dev dependencies.
  - Write `src/i18n/index.js` with `en`, `mr` and `hi`, `fallbackLng:'en'`.
  - Failing test: `t('app.name')` returns a non-empty string in all three languages. Implement, then see it pass.
- [x] **Step 4:** `flutter create --org com.lms --project-name lms_app mobile`.
  - Add the pubspec dependencies from `Flutter_ARCHITECTURE.md` §3, plus `flutter_lints`, `freezed`, `go_router` and `flutter_localizations` (§14.5, §15.2, §15.6).
  - Add `l10n.yaml` and ARB files for en/mr/hi.
  - `flutter analyze` → no issues.
- [x] **Step 5:** Commit `chore: roles matrix, backend needs, web and mobile scaffolds`.

## Phase done when
- [x] `cd api && npm test` passes. `npm run migrate` against the dev DB is applied twice with no errors.
- [x] `docs/` contains ERD.md, openapi.yaml, ROLES.md and BACKEND_NEEDS.md.
- [x] `web`: `npm run build` succeeds. `mobile`: `flutter analyze` is clean.
- [x] Every Review Focus item has a passing test. — mapped 2026-11-18; gaps closed with new tests.
