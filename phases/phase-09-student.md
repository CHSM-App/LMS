# Phase 9: Student Enrollment, Dashboard, Learning, Exams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the whole student side:
- Registration and enroll request
- Dashboard
- Course player with progress
- Notes viewer
- Exam taking (autosave, resume, server timer, auto-submit)
- Results and answer review
- Doubts, attendance and progress, profile

**Architecture:**
- Migration `005_student.sql` (`content_progress`, plus the attempt table columns).
- Every student course route uses `authorize('student')` + `requireActiveEnrollment`.
- The exam runtime reuses the Phase 6 domain functions.

**Tech Stack:** Same as before; `react-pdf` (pdf.js) for the notes viewer.

**Spec:** spec §3.4, §4 Student (Registration, Login) and Student dashboard (all of it), §5 (random test rules, final result), §6 (privacy, blocked teacher read-only).

## Global Constraints
- **Registration fields:** name*, mobile*, OTP*, education*, city, email.
- The enroll request goes to the teacher, who approves it and sets the subscription. Then the student logs in with mobile + OTP.
- **Dashboard sections:**
  - My courses (course, teacher, progress %, subscription end date)
  - All public courses + Enroll
  - Enrollment requests sent (course, date, status)
  - Live class (topic, date, time, Join)
  - Course player (video, module list, mark complete, progress)
  - Notes viewer (PDF title, view, download)
  - Tests (question, options, timer, submit)
  - Results (marks, rank, correct/wrong, explanation)
  - Doubts (question*, course, attachment, teacher reply)
  - Attendance and progress (attendance %, completed lessons, exam performance)
  - Profile and notifications
- **Random tests:** each student gets their own questions, fixed once the attempt starts. Answers autosave. The student can **resume after a network drop with the timer still running**.
- **Mock mode:** timer with auto-submit, attempt limit, result shown after submit. **Practice mode:** answers shown instantly, unlimited attempts, not counted.
- **The Final Exam unlocks after the Unit Tests.**
- **Blocked teacher:** their students keep **read-only access to completed content**.
- A student's mobile number is never visible to other students.
- **Batches (DECISIONS.md):** the student sees their batch on each course. They see only the live classes and programs for their batch (or for all batches), and only exams targeted at their batch (or at all batches).
- **Registration** also requires the Terms/Privacy consent, with an optional WhatsApp opt-in.
- **Account settings:** change mobile number and delete account (built in Phase 3; linked from the student profile here).
- ⏸️ **Mobile offline answer queue is greyed out:** server autosave + in-memory retry only.
- **Videos online + offline (DECISIONS.md "Offline video download rules"):** every video streams online on the web and in the app. **Uploaded** videos can be **downloaded in the app only** for offline viewing, with an encrypted file, a 7-day renewable licence, a 2-device limit and automatic removal. **No share option anywhere.** The API is built here (Task 8); the app screens are built in Phase 10.

## Review Focus
1. **The network drops during a Mock exam and comes back after the deadline:** the server auto-submits at the deadline. Answers saved before the deadline count, and anything later is rejected. Task 4.
2. **Two browser tabs on the same attempt:** the last write per question wins, and both tabs show the same remaining time. Task 4.
3. **Refreshing a random exam** shows the same questions in the same (shuffled) order. Task 4.
4. **A blocked teacher's student** can open lessons already marked complete but not new ones, and can't start exams. Task 3.
5. **A student opens another student's attempt or result by ID** → 404. Task 5.

## Data (005_student.sql + attempt columns in 003)
- `content_progress(student_id, content_id, completed_at, last_position_sec INT, PK(student_id, content_id))`
- `student_devices(device_id VARCHAR(64), student_id FK, device_name NVARCHAR(80), platform VARCHAR(10), registered_at, removed_at NULL, PK(device_id, student_id))` with a filtered index on `(student_id) WHERE removed_at IS NULL`.
- `offline_downloads(download_id, student_id FK, content_id FK, device_id VARCHAR(64), key_id UNIQUEIDENTIFIER, license_expires_at DATETIME2, last_renewed_at, revoked_at NULL, revoke_reason VARCHAR(30) NULL, created_at, UNIQUE(student_id, content_id, device_id))`
- `exam_attempts(attempt_id, public_id, exam_id FK, student_id FK, attempt_no INT, seed INT, started_at, deadline_at NULL, submitted_at NULL, auto_submitted BIT DEFAULT 0, score DECIMAL(7,2) NULL, max_score DECIMAL(7,2) NULL, passed BIT NULL, UNIQUE(exam_id, student_id, attempt_no))`
- `exam_attempt_questions(attempt_id, question_id, sort_order, option_order_json VARCHAR(200), PK(attempt_id, question_id))`
- `attempt_answers(attempt_id, question_id, answer_json NVARCHAR(1000), saved_at, PK(attempt_id, question_id))`

## Endpoints (student)
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register-student | `{name, mobile, otp, education, city?, email?}` → logged in |
| POST | /student/enrollments | `{courseSlug, message?}` → pending |
| GET | /student/enrollments | sent requests |
| GET | /student/dashboard | my courses with progress + end date, upcoming live classes, pending requests |
| GET | /student/courses/:courseId | curriculum + per-content completion |
| GET | /student/contents/:contentId | signed URL (+ last position) |
| POST | /student/contents/:contentId/progress | `{positionSec?, completed?}` |
| GET | /student/courses/:courseId/exams | with `locked` + `attemptsLeft` |
| POST | /student/exams/:examId/attempts | start or resume → `{attemptId, deadlineAt, questions (no answers)}` |
| PUT | /student/attempts/:attemptId/answers/:questionId | autosave |
| POST | /student/attempts/:attemptId/submit | |
| GET | /student/attempts/:attemptId/result | marks, rank, per-question review + explanation |
| GET | /student/courses/:courseId/final-result | weighted |
| GET/POST | /student/doubts | multipart attachment |
| GET | /student/progress | attendance %, completed lessons, exam performance |
| GET/PUT | /student/profile | |
| POST | /student/devices | `{deviceId, deviceName, platform}` → registers the device (max 2 active) |
| GET / DELETE | /student/devices · /student/devices/:deviceId | list · remove (revokes that device's downloads) |
| POST | /student/contents/:contentId/download | header `X-Device-Id` → `{downloadUrl (signed, 10 min), keyId, key (base64, 32 bytes), licenseExpiresAt, sizeBytes}` |
| POST | /student/downloads/renew | `{deviceId, contentIds:[...]}` → `[{contentId, licenseExpiresAt}]` or `{contentId, revoked:true, reason}` |
| POST | /student/progress/sync | `[{contentId, positionSec?, completedAt?}]` (offline progress batch) |

## File Structure
```
api/migrations/005_student.sql
api/src/services/{studentRegistration,studentEnrollment,studentDashboard,player,attempt,studentDoubt,studentProgress}.service.js
api/src/jobs/autoSubmit.job.js
api/src/serializers/{attemptQuestion,attemptResult}.serializer.js
api/tests/integration/student/*.test.js
web/src/app/layouts/StudentLayout.jsx
web/src/features/auth/StudentRegisterPage.jsx, web/src/features/public/enroll/EnrollPage.jsx
web/src/features/student/{dashboard,my-courses,player,notes,exams,results,doubts,progress,profile}/*
```

---

### Task 1: Student registration + enroll request

- [ ] **Step 1:** Write the failing tests:
  - Register with a valid OTP → a user with role `student` and status `approved` is created, plus `student_profiles`, and the student is logged in (tokens issued).
  - A mobile that already belongs to a teacher → 409 "This number is registered as a teacher".
  - Enroll request → `pending`, and the teacher gets a notification.
  - A duplicate request → 409.
  - Re-requesting after a rejection → allowed (the row is reset to pending).
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. The `/enroll/:slug` web flow is: logged out → registration (with OTP) → submit enroll → "Request sent. You'll be notified when {teacher} approves." **Step 4:** Run and see it pass.
- [ ] **Step 5:** Commit `feat(student): registration and enroll request`.

### Task 2: Dashboard + player + notes + progress

**Interfaces:** `progress% = completed contents / total contents` for the course. A completed item counts once.

- [ ] **Step 1:** Write the failing tests:
  - The dashboard lists only approved courses, with progress %, end date and batch name. Upcoming live classes only come from enrolled courses **and the student's batch** (or "all batches").
  - Marking complete updates the %, and doing it twice doesn't double count.
  - `last_position_sec` is saved and returned.
  - A PDF gets a signed URL valid for 10 minutes. A link-type item returns its URL.
  - A course the student isn't enrolled in → 403.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): dashboard, player, notes, progress`.

### Task 3: Blocked-teacher read-only rule

**Interfaces:** Extend `requireActiveEnrollment({ allowReadOnly })`. When the teacher is blocked: content GET is allowed only if `content_progress.completed_at` exists, and every write (progress, attempts, doubts) → 403 "This course is read-only because the teacher's account is inactive".

- [ ] **Step 1:** Write the failing tests covering all of the above, plus a check that the dashboard shows the course with a read-only label.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): read-only access for blocked teachers`.

### Task 4: Exam runtime

**Interfaces:**
- `attemptService.startOrResume(examId, studentId) -> {attemptId, deadlineAt|null, questions}`
  - If an open attempt exists, it returns that attempt unchanged.
  - Otherwise it checks: not locked (`isFinalUnlocked`), within the start/end dates, attempts left > 0 (Mock).
  - Then it creates the attempt with `seed`, freezes the questions via `selectQuestions`, applies the shuffle, and sets `deadline_at = MIN(started_at + time_limit, ends_at)`.
- `attemptService.saveAnswer(attemptId, studentId, questionId, answer)` → rejected with 409 "Time is up" when `now > deadline_at`.
- `attemptService.submit(attemptId, studentId, {auto})` → scores with `scoreAttempt` and stores the score, max and passed.
- Questions are serialized **without** `is_correct` / accepted answers in Mock mode. In Practice mode, the answer to `saveAnswer` includes `{correct, explanation}` straight away.
- `autoSubmit.job` runs every minute and submits every attempt where `deadline_at < now AND submitted_at IS NULL`. Any request that touches an expired attempt also submits it lazily.

- [ ] **Step 1:** Write the failing tests:
  - Start → the questions have no answers. Calling start again → the same attemptId, the same questions in the same order.
  - Another student → a different set (random mode, seeded).
  - Saving an answer twice → the last one wins.
  - A save after the deadline (clock injected) → 409, and the attempt is auto-submitted with `auto_submitted=1` and only the answers saved earlier.
  - Attempts are capped at the limit: the next start → 403 "No attempts left".
  - The Final is locked before the Unit Tests → 403 "Complete Unit Test 1 and Unit Test 2 first".
  - Outside the start/end window → 403.
  - An exam targeted at batch B, started by a batch A student → 404, and it isn't in their exam list.
  - Practice: a save returns correctness, there's no deadline, the attempts are unlimited, and they're excluded from the final result.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): exam attempts with autosave, resume and auto-submit`.

### Task 5: Results, review, final result

- [ ] **Step 1:** Write the failing tests:
  - Before submit, the result → 403. After submit → marks, rank, and per-question (your answer, correct answer, explanation).
  - Another student's attempt → 404.
  - The final result matches the Phase 6 `finalResult` (weighted %, per exam, per module, pass/fail).
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): results and answer review`.

### Task 6: Doubts, attendance/progress, profile

- [ ] **Step 1:** Write the failing tests:
  - A student creates a doubt with an attachment (image/pdf ≤ 5 MB) and sees only their own doubts with the teacher's replies.
  - The progress endpoint returns attendance % (present / held live classes), completed lessons and exam performance.
  - The profile is updatable, but the mobile can't be changed here.
  - No endpoint returns another student's mobile: run a key scan over every student response.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): doubts, progress, profile`.

### Task 6b: Offline download licences (API)

**Interfaces:**
- `deviceService.register(studentId, {deviceId, deviceName, platform})` → 409 `{code:'DEVICE_LIMIT', error:'Downloads are allowed on 2 devices. Remove one in Profile → Downloads.'}` for a third device.
- `downloadService.issue(studentId, contentId, deviceId) -> {downloadUrl, keyId, key, licenseExpiresAt, sizeBytes}`. `licenseExpiresAt = MIN(now + 7 days, subscription end_date 23:59 IST)`. `key = HMAC_SHA256(DOWNLOAD_KEY_SECRET, keyId|deviceId)`, so it isn't stored in plain text.
- `downloadService.renew(studentId, deviceId, contentIds)`
- `downloadService.revokeFor({studentId?, courseId?, deviceId?, reason})`, called when the subscription ends, access is paused, an enrollment is rejected or blocked, the student logs out on a device, or the account is deleted.

- [ ] **Step 1:** Write the failing tests:
  - Issue for an uploaded video of an active enrollment → 200, and the response has every field.
  - A YouTube/Vimeo/Bunny video → 409 "This video can only be watched online".
  - A PDF or link content item → 400.
  - Not enrolled → 403. Access paused → 403.
  - An unregistered device → 403 "Register this device first".
  - A third device → 409 `DEVICE_LIMIT`. Removing a device → its downloads are revoked and a new device can register.
  - The licence never passes the subscription end: with 3 days left, the expiry is the end date.
  - Renew: active → a new expiry. Subscription ended → `revoked:true, reason:'subscription_ended'`.
  - A blocked teacher: a completed content item renews, and an incomplete one is revoked with `reason:'teacher_inactive'`.
  - Logout with a device id → that device's downloads are revoked. Account deletion → all of them are revoked.
  - No response contains a share URL or a permanent file URL (the signed URL expires in 10 minutes).
  - Progress sync: a batch of offline positions is saved, and a later `completedAt` never un-completes an item.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(student): offline download licences and progress sync`.

### Task 7: Student web screens

- [ ] **Step 1:** Write failing Vitest tests:
  - The exam screen shows a countdown from the server's `deadlineAt` (not the local clock), autosaves when an answer changes (debounced), shows "Saved" / "Offline — answers will sync", and calls submit when the timer hits 0.
  - The player's "Mark complete" updates the progress bar.
  - The web player streams only. There is no download control and no right-click "Save video" (`controlsList="nodownload"`, context menu off), and it shows the hint "Download in the app to watch offline" for uploaded videos.
  - A locked Final shows the unlock rule.
- [ ] **Step 2:** Run and see it fail.
- [ ] **Step 3:** Build:
  - `StudentLayout` with nav: Dashboard, My courses, Browse courses, Live classes, Exams, Results, Doubts, Progress, Profile, Notifications.
  - Every section listed in Global Constraints.
  - The exam screen keeps unsent answers in memory, retries when back online, and warns before leaving the page.
- [ ] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(web): student app`.

## Phase done when
- [ ] Tests pass. Full manual run:
  1. Enroll → the teacher approves.
  2. Watch lessons → the progress % updates.
  3. Take UT1 and UT2 → the Final unlocks.
  4. Drop the network mid-Final → resume with the timer still running.
  5. Let it auto-submit → see the result and the weighted final.
  6. Block the teacher → read-only access.
- [ ] Review Focus is covered and `/security-review` is clean.
