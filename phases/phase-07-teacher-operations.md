# Phase 7: Teacher Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the rest of the teacher's day-to-day tools:
- Live demo and enrollment requests, with Meet links sent on WhatsApp
- Per-student access and subscriptions
- Student list
- Live classes and attendance
- Doubts
- Class programs
- Public profile editor

**Architecture:**
- Migration `004_operations.sql`.
- Meet links go through `providers/meet`, and WhatsApp messages through `providers/whatsapp`. Both have `console` dev implementations.
- The real student count replaces the Phase 4 stub.

**Tech Stack:** Same as before, plus `node-cron` for reminders and cleanup.

**Spec:** spec §3.3 steps 4–5, §3.4 step 3, §4 Teacher (Live class schedule, Student list, Enrollment and demo requests, Attendance, Doubts, Class programs, Login access and subscription per student, Profile and public profile editor, Notifications), §6, §7.

## Global Constraints
- **Demo requests:** go to that course's teacher. The teacher sets the date and time and generates a Google Meet link, which is **sent to the student on WhatsApp**.
- **Enrollment:** the teacher approves the request and sets the subscription for that student and course.
- **Requests page fields:** student name, mobile, education, course, message, date/time to set, Meet link, "Send on WhatsApp", Approve / Reject.
- **Live class fields:** course*, topic*, date*, time*, Meet link*, status.
- **Student list fields:** name, mobile, course, enrolled date, subscription status.
- **Attendance fields:** live class*, student*, present/absent*, date.
- **Doubts fields:** student, course, question, attachment, reply*, status.
- **Class programs fields:** title*, date*, time*, batch.
- **Access per student fields:** student*, course*, start date*, end date*, status, access on/off.
- **Profile fields:** name*, mobile, email, photo, bio, subjects, experience, intro video, social links, language.
- Statuses everywhere: Pending, Approved, Rejected, Blocked.
- A teacher sees full student mobile numbers only for their own students and requests.
- **Batches (DECISIONS.md):**
  - Approving an enrollment **requires choosing a batch**: an active batch of that course that isn't full.
  - The teacher can move a student to another batch.
  - Live classes, class programs and attendance target **one batch or all batches**.
  - Student list and attendance can be filtered by batch.
- **WhatsApp + Meet (DECISIONS.md):** the official WhatsApp Business API and automatic Google Meet links. **Fallbacks:** if the provider isn't configured or fails, the UI offers "Open in WhatsApp" (a `wa.me` link with the message typed) and "Paste Meet link". WhatsApp is sent only to people who opted in.
- **Limited mode:** a teacher whose subscription has expired **cannot approve enrollments** (`requireActiveTeacherSubscription`). Everything else works.

## Review Focus
1. **The WhatsApp send fails** (provider error): the request still saves, the UI shows "Not sent. Try again", and resending works. Task 1.
2. **A subscription that ends today** still gives access until the end of the day, in IST. Store dates as `DATE` and compare against today's IST date. Task 2.
3. **Approving an enrollment twice** (double click) creates one enrollment and one subscription. Task 2 (unique `(student_id, course_id)` + transaction).
4. **Marking attendance for a student not enrolled in that course** → 400. Task 4.
5. **Access switched off mid-session:** the student's next content request → 403 "Your access to this course is paused". Task 2 (`requireActiveEnrollment` reads live).

## Data (004_operations.sql)
- `demo_requests(demo_request_id, course_id FK, teacher_id FK, name NVARCHAR(120), mobile VARCHAR(15), education NVARCHAR(120), class_standard NVARCHAR(40), preferred_time NVARCHAR(80), message NVARCHAR(1000), status VARCHAR(10) CHECK IN ('pending','scheduled','completed','rejected'), scheduled_at DATETIME2 NULL, meet_link VARCHAR(300) NULL, whatsapp_sent_at NULL, whatsapp_error NVARCHAR(300) NULL, created_at)` with an index on `(teacher_id, status, created_at DESC)`.
- `enrollments(enrollment_id, student_id FK, course_id FK, teacher_id FK, batch_id FK batches NULL /*required once approved*/, status VARCHAR(10) CHECK IN ('pending','approved','rejected','blocked'), message NVARCHAR(1000), reject_reason NVARCHAR(500), requested_at, decided_at, UNIQUE(student_id, course_id))`
- `student_subscriptions(student_subscription_id, enrollment_id FK UNIQUE, start_date DATE, end_date DATE, access_enabled BIT DEFAULT 1, CHECK end_date>=start_date)`
- `live_classes(live_class_id, course_id FK, batch_id FK NULL /*NULL = all batches*/, reminder_sent_at NULL, topic NVARCHAR(200), starts_at DATETIME2, duration_min INT, meet_link VARCHAR(300), status VARCHAR(10) CHECK IN ('scheduled','live','completed','cancelled'))`
- `attendance(live_class_id FK, student_id FK, present BIT, marked_at, PK(live_class_id, student_id))`
- `doubts(doubt_id, student_id FK, course_id FK, question NVARCHAR(2000), attachment_key NULL, reply NVARCHAR(2000) NULL, replied_at NULL, status VARCHAR(8) CHECK IN ('open','answered','closed'), created_at)`
- `class_programs(program_id, teacher_id FK, course_id FK NULL, batch_id FK NULL /*NULL = all*/, title NVARCHAR(200), starts_at DATETIME2)`

## Endpoints (teacher, owner only)
| Method | Path | Notes |
|---|---|---|
| GET | /teacher/demo-requests?status= | |
| POST | /teacher/demo-requests/:id/schedule | `{scheduledAt, meetLink?}`; generates a link if one isn't given |
| POST | /teacher/demo-requests/:id/send-whatsapp | sends or resends |
| POST | /teacher/demo-requests/:id/reject · /complete | |
| GET | /teacher/enrollments?status= | |
| POST | /teacher/enrollments/:id/approve | `{batchId, startDate, endDate}` → creates the subscription, notifies the student |
| PUT | /teacher/enrollments/:id/batch | `{batchId}` (move a student to another batch) |
| POST | /teacher/enrollments/:id/reject | `{reason}` |
| GET | /teacher/students?course=&q=&page= | name, mobile, course, enrolledAt, subscriptionStatus |
| PUT | /teacher/students/:studentPublicId/access/:courseId | `{startDate, endDate, accessEnabled}` |
| GET/POST/PUT/DELETE | /teacher/live-classes | |
| GET/PUT | /teacher/live-classes/:id/attendance | `[{studentPublicId, present}]` |
| GET | /teacher/doubts?status= · POST /teacher/doubts/:id/reply | |
| GET/POST/PUT/DELETE | /teacher/programs | |
| GET/PUT | /teacher/profile | public profile fields + `publicSlug` |

## File Structure
```
api/migrations/004_operations.sql
api/src/providers/{meet,whatsapp}/{index,console,google,metaCloud}.js
api/src/middlewares/requireActiveEnrollment.js
api/src/services/{demoRequest,enrollment,studentAccess,liveClass,attendance,doubt,program,teacherProfile}.service.js
api/src/repositories/(matching) + studentCount.repo.js (real implementation)
api/src/jobs/{liveClassReminder,cleanup}.job.js
api/tests/integration/teacher/{demoRequests,enrollments,students,liveClasses,attendance,doubts,programs,profile}.test.js
web/src/features/teacher/{requests,students,live-classes,attendance,doubts,programs,profile}/*
```

---

### Task 1: Demo requests + Meet + WhatsApp

**Interfaces:**
- `meet.createLink({ title, start, durationMin }) -> url`. The console implementation returns `https://meet.google.com/dev-xxxx`.
- `whatsApp.send(mobile, text) -> { ok, error? }`
- `demoRequestService.schedule(id, teacherId, {scheduledAt, meetLink?})` and `.sendWhatsApp(id, teacherId)`.
- Message text (i18n key `wa.demo_scheduled`): "Hello {name}, your live demo for {course} is on {date} at {time}. Join: {link}"

- [x] **Step 1:** Write the failing tests:
  - Schedule with no link → the link is generated and the status is `scheduled`.
  - Schedule with a pasted link → it must match `^https://meet\.google\.com/` and is stored.
  - A date in the past → 400.
  - send-whatsapp → `whatsapp_sent_at` is set. When the provider throws → `whatsapp_error` is stored, the response is 502 `{error:'WhatsApp message not sent. Try again.', fallbackUrl:'https://wa.me/91XXXXXXXXXX?text=...'}`, and the status stays `scheduled`. A resend succeeds.
  - A student without WhatsApp opt-in → 409 "This student hasn't agreed to WhatsApp messages", plus the `fallbackUrl`.
  - `MEET_PROVIDER=manual` and no link given → 400 "Paste a Meet link".
  - Another teacher's request → 404.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): demo requests with Meet link and WhatsApp`.

### Task 2: Enrollments, access, student count

**Interfaces:**
- `enrollmentService.approve(id, teacherId, {startDate, endDate})` and `.reject(id, teacherId, reason)`.
- `requireActiveEnrollment(courseParam)`: passes only when the enrollment is `approved`, `access_enabled = 1` and today (IST) is within the dates. It also handles the blocked-teacher read-only rule, which Phase 9 adds.
- The real `studentCountRepo.countActiveByTeacher`.

- [x] **Step 1:** Write the failing tests:
  - Approve → the enrollment is `approved` with a `batch_id`, a subscription is created, and the student gets the notification "You're enrolled in {course} ({batch})".
  - Approve without a batch → 400. A closed batch → 409 "This batch is closed". A full batch → 409 "This batch is full ({max} students)".
  - Move batch → updated, and the student is notified.
  - Approve while the teacher's subscription has expired → 403 `TEACHER_SUBSCRIPTION_EXPIRED`.
  - Two parallel approves → one subscription.
  - Reject with no reason → 400.
  - End date before start date → 400.
  - `requireActiveEnrollment`:
    - A sub ending today → allowed.
    - Ended yesterday → 403 "Your access to this course has ended".
    - `access_enabled=0` → 403 "Your access to this course is paused".
  - **The Phase 4 test:** teacher A has 2 active, 1 pending and 1 expired → `studentCount=2`.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): enrollment approval and student access`.

### Task 3: Student list

- [x] **Step 1:** Write the failing tests:
  - Only the teacher's own students are listed.
  - A student enrolled with two teachers appears to each teacher with only that teacher's courses.
  - Filtering by course and searching by name work.
  - The subscription status is computed as active / expired / paused.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): student list`.

### Task 4: Live classes + attendance

- [x] **Step 1:** Write the failing tests:
  - Create a live class for batch A → only batch A students get a notification. "All batches" → every enrolled student is notified.
  - The attendance sheet for a batch-A class lists only batch A students.
  - A missing Meet link → generate one (or 400 when the provider is `manual`).
  - Attendance PUT is an upsert: running it twice gives no duplicates.
  - A non-enrolled student → 400.
  - The reminder job notifies students 30 minutes before the start, exactly once (`reminder_sent_at`).
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): live classes and attendance`.

### Task 5: Doubts, programs, public profile

- [x] **Step 1:** Write the failing tests:
  - A reply sets the status to `answered` and notifies the student.
  - A reply over 2,000 characters → 400.
  - Programs CRUD works.
  - Profile update works. `publicSlug` must be unique (409) and match `^[a-z0-9-]{3,60}$`.
  - The bio is sanitized: a `<script>` tag is stripped.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): doubts, programs, public profile`.

### Task 6: Teacher web screens

- [x] **Step 1:** Write failing Vitest tests:
  - The Requests page has Demo and Enrollment tabs.
  - The schedule dialog requires a date/time.
  - "Send on WhatsApp" shows Sent ✓ or Not sent with a Retry button.
  - The approve dialog requires start and end dates.
  - The attendance sheet has a "Mark all present" toggle.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Build the pages for Requests, Students (with an access editor drawer), Live classes, Attendance, Doubts, Programs and Profile (with a live public profile preview). Add a teacher dashboard with tiles: pending requests, today's classes, open doubts, active students.
- [x] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(web): teacher operations`.

### Task 7: Light teacher screens in Flutter (DECISIONS.md)
- [x] Teacher app screens: dashboard, requests (schedule, send WhatsApp, approve with a batch picker), students (batch filter, access toggle), live classes + attendance, doubts, notifications, profile. Each one gets a ViewModel test + a widget test. Commit `feat(mobile): light teacher app`.

## Open questions
- Meet link generation needs a Google Workspace account and OAuth (see BACKEND_NEEDS). Until then the teacher pastes the link.
- WhatsApp needs a Meta-approved template, and the message text must match that template exactly.
- The batch rules are assumed (DECISIONS.md) and still need confirmation.

## Phase done when
- [x] Tests pass. Manual run with seeded requests: schedule a demo → console shows the WhatsApp message; approve an enrollment → the student list shows active; take attendance; answer a doubt. — **Automated** in `web/e2e/` (23 Playwright specs, 2026-11-18).
- [x] Review Focus is covered and `/security-review` is clean. — **Self-review** 2026-11-18 (the `/security-review` command needs a git remote; findings fixed: auth before validation, role matrix, security logging, token grace).
