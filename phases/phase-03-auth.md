# Phase 3: Auth + Teacher Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile + OTP login for all roles, access/refresh tokens, role guards, the "Become a Teacher" registration, and admin accept/reject with reapply.

**Architecture:**
- `auth.service` owns the OTP and token logic. OTP delivery goes through `providers/otp` (`console` in dev).
- `authenticate` + `authorize` protect every non-public route.
- Web uses an in-memory access token, with the refresh token in an HttpOnly cookie. Flutter uses secure storage plus one in-flight refresh.

**Tech Stack:** jsonwebtoken, crypto (randomInt, HMAC), cookie-parser; React Router guards; Flutter Dio interceptor, go_router redirect.

**Spec:** spec §3.1, §4 Teacher Registration/Login, §4 Super Admin Teacher requests, §6, §7. `guidelines/SECURITY.md` §1–3.

## Global Constraints
- No passwords: mobile + OTP only.
- OTP: 6 digits, **5-minute expiry**, **3 resends per 15 minutes**, **5 verify attempts**, stored hashed.
- Access token 15 minutes. Refresh token 30 days, rotated, with reuse detection that revokes the family.
- Teacher registration fields: name*, mobile*, OTP*, course*, subject*, experience in years*; email, city, qualification, photo and ID/certificate upload are optional.
- A rejected teacher's request needs a reject reason, and a rejected teacher can reapply.
- After a request is created, the Super Admin gets a notification.
- Only `approved` users can log in. `pending` gets "Your request is under review", `rejected` gets "Your request was rejected: <reason>. You can apply again.", and `blocked` gets "Your account is blocked. Contact support." **Every one of these screens shows a "Contact support" link** (`SUPPORT_CONTACT` env var).
- **Consent (DECISIONS.md):** registration requires the "I agree to the Terms and Privacy Policy" checkbox, plus an optional WhatsApp opt-in checkbox. Both are stored in `legal_consents`.
- **Account deletion + change mobile number** (DECISIONS.md) are built in this phase (Task 7).

## Review Focus
1. **Two OTP sends within the same second** for one number: both are counted toward the resend limit (no race). Task 1 concurrent test.
2. **The same refresh token used twice** (e.g. two tabs): the second use revokes the family, and the user must log in again. Task 2.
3. **A teacher reapplies while a pending request already exists:** 409 "A request is already pending". Task 4.
4. **A mobile number entered with spaces or dashes** logs in to the same account. Task 1 (normalizeMobile).
5. **An admin is blocked mid-session:** the next API call returns 401, even though the access token hasn't expired. Task 3 (DB status check).

## Endpoints
| Method | Path | Role | Body / result |
|---|---|---|---|
| POST | /auth/otp/send | public | `{mobile, purpose}` → `{sent:true, resendAfterSec}` |
| POST | /auth/login | public | `{mobile, otp}` → `{accessToken, user:{publicId,name,role,status}}` + refresh cookie |
| POST | /auth/refresh | cookie | → `{accessToken}` + rotated cookie |
| POST | /auth/logout | auth | revokes the current family |
| GET | /auth/me | auth | → user + profile |
| POST | /teacher-requests | public | multipart: registration fields + `otp` → `{requestId, status:'pending'}` |
| GET | /teacher-requests/status?mobile= (OTP-verified) | public | → `{status, rejectReason?}` |
| GET | /admin/teacher-requests?status=&page= | admin | list |
| POST | /admin/teacher-requests/:id/accept | admin | creates/approves the user + teacher_profile, notifies |
| POST | /admin/teacher-requests/:id/reject | admin | `{reason}` (required, 5–500 chars) |
| POST | /account/change-mobile/start | auth | `{newMobile}` → sends an OTP to the new number |
| POST | /account/change-mobile/confirm | auth | `{newMobile, otp}` → mobile updated, other sessions revoked |
| POST | /admin/users/:publicId/change-mobile | admin | `{newMobile, reason}` (lost SIM), audit logged |
| POST | /account/delete | auth | `{otp}` (OTP to the current mobile, purpose `delete_account`) → anonymised |
| GET | /public/legal/:doc | public | `terms` / `privacy` → `{version, html}` |

## File Structure
```
api/src/providers/otp/{index,console,msg91}.js
api/src/services/{otp.service,token.service,auth.service,teacherRequest.service,notification.service,audit.service}.js
api/src/repositories/{otp.repo,token.repo,user.repo,teacherRequest.repo,notification.repo,audit.repo}.js
api/src/middlewares/{authenticate,authorize,upload}.js
api/src/controllers/{auth,teacherRequest,adminTeacherRequest}.controller.js
api/src/routes/{auth,public,admin}.routes.js
api/src/serializers/user.serializer.js
api/scripts/seed.js (creates the super admin from SEED_ADMIN_MOBILE)
api/tests/integration/{otp,login,refresh,guards,teacherRequest}.test.js
web/src/api/client.js, web/src/app/{router.jsx,RequireRole.jsx,AuthProvider.jsx}
web/src/features/auth/{LoginPage,OtpStep,BecomeTeacherPage,RequestStatusPage}.jsx
web/src/features/admin/teacher-requests/{TeacherRequestsPage,RejectDialog}.jsx
mobile/lib/core/network/{dio_provider,interceptor,token_provider}.dart (with §14.1–14.4 + §15.1 fixes)
mobile/lib/screens/auth/{splash_screen,login_screen,otp_screen,become_teacher_screen}.dart
```

---

### Task 1: OTP send + verify

**Interfaces:**
- Produces `otpService.send(mobile, purpose) -> { resendAfterSec }` and `otpService.verify(mobile, purpose, code) -> true`. Both throw `APIError` for the cases below.
- Produces `otpSender.send(mobile, code)`. The console implementation logs `OTP for 98XXXXXX10: 123456` in dev only.

- [x] **Step 1:** Write the failing tests (`otp.test.js`):
  - send → a row exists, `code_hash` is not equal to the code, and `expires_at` ≈ now + 5 minutes.
  - The 4th send within 15 minutes → 429 "Too many OTP requests. Try again in N minutes."
  - verify with the right code → true, and `consumed_at` is set. Verifying again → 400 "OTP expired or already used".
  - 5 wrong codes → the 6th try (even with the right code) → 400 "Too many wrong attempts. Request a new OTP."
  - verify after 5 minutes (clock injected) → 400 "OTP expired or already used".
  - Two parallel sends → `resend_count` = 2 (the row is locked with `UPDLOCK, HOLDLOCK`).
  - The responses for unknown and known mobiles are identical.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Implement. The hash is `HMAC_SHA256(OTP_SECRET, mobile|purpose|code)`, compared with `crypto.timingSafeEqual`. Apply `authLimiter` (5 per minute per IP) on `/auth/*`.
- [x] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(auth): OTP send/verify with limits`.

### Task 2: Tokens + login/refresh/logout

**Interfaces:**
- Produces `tokenService.issue(user) -> { accessToken, refreshToken }`, `tokenService.rotate(refreshToken) -> { accessToken, refreshToken, user }`, `tokenService.revokeFamily(familyId)` and `tokenService.revokeAllForUser(userId)`.
- The access JWT payload is `{ sub: user_id, role, pid: public_id }` with an expiry of 15 minutes.

- [x] **Step 1:** Write the failing tests (`login.test.js`, `refresh.test.js`):
  - Login as an approved teacher → 200, an `accessToken`, and a `Set-Cookie` header with `rt=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
  - Login for a `pending` / `rejected` / `blocked` user → 403 with the exact messages from Global Constraints.
  - Login for a mobile with no account → 404 "No account found for this mobile number".
  - Refresh → a new cookie, and the old token now has `revoked_at` set.
  - Reusing the old refresh token → 401, and every token in the family is revoked.
  - Logout → the cookie is cleared, and a refresh after that → 401.
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. Refresh tokens are 48 random bytes, base64url, stored as SHA-256. **Step 4:** Run and see it pass.
- [x] **Step 5:** Commit `feat(auth): login, refresh rotation, logout`.

### Task 3: Guards

**Interfaces:** Produces `authenticate` (sets `req.user = { id, role, publicId, status }` from the DB, cached 60 s) and `authorize(...roles)`.

- [x] **Step 1:** Write the failing tests (`guards.test.js`):
  - No token → 401.
  - Expired token → 401 with `code:"TOKEN_EXPIRED"`.
  - A student calling `GET /admin/teacher-requests` → 403.
  - A user blocked after the token was issued → 401 on the next call. Clear the cache in the test.
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run and see it pass. **Step 5:** Commit `feat(auth): authenticate and authorize middleware`.

### Task 4: Teacher registration + admin review

**Interfaces:**
- Consumes `otpService.verify`, `notify(userId, {...})` and `audit(...)`.
- Produces `teacherRequestService.create(fields, files)`, `.accept(requestId, adminId, ip)` and `.reject(requestId, adminId, reason, ip)`.

- [x] **Step 1:** Write the failing tests (`teacherRequest.test.js`):
  - Valid registration + OTP → 201 with status `pending`, and every admin gets the notification "New teacher request: <name>".
  - A missing required field (e.g. `subject`) → 400.
  - A wrong OTP → 400 and no row is created.
  - A second request while one is pending → 409 "A request is already pending".
  - Accept → a `users` row is created with role `teacher` and status `approved`, a `teacher_profiles` row is created, the request is `approved`, an audit row with action `teacher_request.accept` is written, and the teacher can now log in.
  - Reject with no reason → 400. Reject with a reason → the request is `rejected` and an audit row is written.
  - After a rejection, the same mobile can submit a new request → 201.
  - Photo and ID upload: wrong type (checked by magic bytes) → 400. Over 5 MB → 413.
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. Accept runs inside `withTransaction`. `upload` middleware: multer with disk storage, random names, and `file-type` magic-byte checks. **Step 4:** Run and see it pass.
- [x] **Step 5:** `scripts/seed.js` creates the admin user from `SEED_ADMIN_MOBILE`, plus 1 pending request.
- [x] **Step 6:** Commit `feat(auth): teacher onboarding and admin review`.

### Task 5: Web auth screens

**Interfaces:**
- Produces `apiClient.request(method, path, body)`. It attaches the in-memory access token. On 401 with `TOKEN_EXPIRED` it calls `/auth/refresh` **once** (shared promise) and retries the request.
- Produces `useAuth() -> { user, login, logout }` and `<RequireRole roles={[...]}>`.

- [x] **Step 1:** Write failing Vitest tests:
  - Two parallel 401s → only one refresh call.
  - `RequireRole roles={['admin']}` with a teacher user → redirect to `/teacher`.
  - The login form shows the OTP step after a successful send, and a resend countdown.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Implement these routes:
  - `/login`
  - `/become-teacher` (form fields from Global Constraints, photo/ID upload)
  - `/become-teacher/status`
  - `/admin/teacher-requests` (table: name, mobile, course, subject, experience, status, created date; Accept button; Reject opens `RejectDialog` with a required reason)
  - On start-up the app calls `/auth/refresh` to restore the session.
- [x] **Step 4:** Run and see it pass. Check manually with console OTPs. **Step 5:** Commit `feat(web): login, teacher registration, admin request review`.

### Task 6: Flutter auth

- [x] **Step 1:** Write failing tests:
  - `TokenInterceptor`: two concurrent 401s → one refresh (§14.3).
  - `isLoggedIn` is false when the role is null (§14.4).
  - `LoginViewModel` moves through `idle → otpSent → verified`, and shows the error message on 429.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Implement per `Flutter_ARCHITECTURE.md` §4–5 with the §14.1–14.4 fixes and §15.1, §15.6, §15.7 (sync `dioProvider`, `sessionProvider`, go_router redirect by role). The mobile app sends the refresh token in the body (`{refreshToken}`), because it doesn't use cookies; the API accepts either.
  - Screens: splash (role gate), login, OTP, become-teacher.
- [x] **Step 4:** Run `flutter test` and see it pass. **Step 5:** Commit `feat(mobile): OTP login and teacher registration`.

### Task 7: Consent, change mobile number, delete account, legal pages

**Interfaces:**
- `consentService.record({userId?, mobile, type, policyVersion, ip})`
- `accountService.startChangeMobile(userId, newMobile)` and `.confirmChangeMobile(userId, newMobile, otp)`
- `accountService.adminChangeMobile(adminId, publicId, newMobile, reason, ip)`
- `accountService.delete(userId, otp)`

- [x] **Step 1:** Write the failing tests:
  - Teacher registration without `acceptTerms=true` → 400 "Accept the Terms and Privacy Policy to continue". With it → a `legal_consents` row with the current `POLICY_VERSION`.
  - `whatsappOptIn=true` → `users.whatsapp_opt_in=1` and a consent row.
  - Change mobile:
    - A new number already in use → 409 "This number is already registered".
    - The right OTP → the mobile is updated, the other refresh tokens are revoked, and both numbers get a notification.
    - A wrong OTP → no change.
  - Admin change → an audit row `user.change_mobile`, and a reason is required.
  - Delete account:
    - The right OTP → name `Deleted user`, mobile `del-<id>`, email/photo/profile text are null, `deleted_at` is set, all tokens are revoked, and login with the old number → 404.
    - The old number can register again.
    - The teacher still sees that student's exam rows as "Deleted user".
    - A teacher with students cannot self-delete → 409 "Contact the admin to close a teacher account".
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run and see it pass.
- [x] **Step 5:** Web: consent checkboxes on the registration forms, `/account` settings (change mobile, delete account with an OTP confirm dialog), `/terms` and `/privacy` pages (content in `api/content/legal/{terms,privacy}.{en,mr,hi}.md`, versioned), a support link on the blocked/rejected screens. Flutter: the same account screens.
- [x] **Step 6:** Commit `feat(auth): consent, change mobile, account deletion, legal pages`.

## Phase done when
- [x] All API, web and Flutter tests pass.
- [x] Manual run: register a teacher → admin accepts → teacher logs in and lands on the empty Teacher Dashboard. Reject → reapply works. — **Automated** in `web/e2e/` (23 Playwright specs, 2026-11-18).
- [x] Every Review Focus item has a passing test. — mapped 2026-11-18; gaps closed with new tests. `/security-review` is clean. — **Self-review** 2026-11-18 (the `/security-review` command needs a git remote; findings fixed: auth before validation, role matrix, security logging, token grace).
