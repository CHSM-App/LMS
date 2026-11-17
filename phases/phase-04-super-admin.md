# Phase 4: Super Admin App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Super Admin everything spec §3.2 allows, and nothing more: teacher list with student counts, block/activate, teacher subscriptions, notifications and the audit log.

**Architecture:** `admin.routes.js` is protected by `authorize('admin')`. Every write goes through a service that calls `audit()` in the same transaction. Notifications use the shared `notification.service` from Phase 3.

**Tech Stack:** Same as Phase 3.

**Spec:** spec §3.2, §4 Super Admin (Teacher list, Subscription management, Notifications), §6 (audit log, blocked teacher rule), §7.

## Global Constraints
- The admin **only** approves/rejects, blocks/activates and manages teacher subscriptions, sees the student count under each teacher, and receives notifications. **The admin does not manage courses, content or exams.**
- Teacher list fields: name, mobile, subject, status, joined date, student count, Block / Activate.
- Subscription fields: teacher*, plan*, start date*, end date*, status, student count.
- **Plan (DECISIONS.md):** `monthly` / `quarterly` / `half_yearly` / `yearly` fill in the end date automatically (start + 1/3/6/12 months − 1 day). `custom` requires the admin to pick the end date.
- **Expired subscription = limited mode (DECISIONS.md):** the teacher can still log in, but cannot publish courses or approve enrollments. Enforced by `requireActiveTeacherSubscription`, used in Phases 5 and 7.
- **Expiry reminders:** 7 days before `end_date`, notify the teacher and every admin (in-app, plus WhatsApp to the teacher if they opted in). Sent once (`reminder_sent_at`).
- The admin can change a user's mobile number (lost SIM). The API is built in Phase 3; this phase adds the UI on the teacher detail page.
- Notifications fields: title, message, date, read/unread.
- Every admin action is written to the audit log.
- Blocking a teacher revokes all of their sessions. Their students keep read-only access to completed content (enforced in Phase 9; this phase sets the status).

## Review Focus
1. **Blocking a teacher who is currently logged in:** their next request returns 401 straight away (tokens revoked + status check). Task 2.
2. **A subscription end date before its start date** → 400 "End date must be on or after start date". Task 3.
3. **Overlapping subscriptions for one teacher:** 409 "This teacher already has a subscription for these dates". Task 3.
4. **Student count only counts approved enrollments with an active subscription**, never pending or rejected ones. The enrollment tables arrive in Phase 7 (`004_operations.sql`), so this phase calls `studentCountRepo.countActiveByTeacher(teacherIds) -> Map<teacherId, number>`, which returns 0s until then. **Phase 7 Task 2 replaces it with the real query and adds this test.**
5. **An admin trying to reach a course endpoint** (`/teacher/courses`) → 403. Task 2 guard test.

## Endpoints
| Method | Path | Body / result |
|---|---|---|
| GET | /admin/dashboard | `{pendingRequests, activeTeachers, blockedTeachers, totalStudents, expiringSubscriptions7d}` |
| GET | /admin/teachers?status=&q=&page= | rows: `{publicId, name, mobile, subject, status, joinedAt, studentCount}` |
| GET | /admin/teachers/:publicId | detail + subscriptions |
| POST | /admin/teachers/:publicId/block | `{reason}` |
| POST | /admin/teachers/:publicId/activate | – |
| GET | /admin/subscriptions?teacher=&status=&page= | rows incl. `studentCount` |
| POST | /admin/subscriptions | `{teacherPublicId, planType, startDate, endDate?}`. `endDate` is required only when the plan is `custom` |
| PUT | /admin/subscriptions/:id | same fields + `status` |
| GET | /notifications?unread=&page= | (shared, any role) |
| POST | /notifications/:id/read · POST /notifications/read-all | – |
| GET | /admin/audit-log?action=&from=&to=&page= | rows |

Subscription `status` is computed for display (`active` if today is within the dates, `upcoming`, `expired`) unless it is set to `blocked`.

## File Structure
```
api/src/routes/admin.routes.js (extend), notification.routes.js
api/src/services/{adminTeacher,teacherSubscription}.service.js
api/src/repositories/{adminTeacher,teacherSubscription}.repo.js
api/src/controllers/{adminTeacher,teacherSubscription,notification,audit}.controller.js
api/tests/integration/{adminTeachers,teacherSubscriptions,notifications,auditLog}.test.js
web/src/app/layouts/AdminLayout.jsx
web/src/features/admin/{dashboard,teachers,subscriptions,notifications,audit-log}/*
mobile/lib/screens/admin/* (deferred to Phase 10)
```

---

### Task 1: Teacher list + student count + dashboard

**Interfaces:** Produces `adminTeacherRepo.list({status, q, offset, limit}) -> {rows, total}` and `studentCountRepo.countActiveByTeacher(teacherIds) -> Map`. This phase ships the stub that returns 0; Phase 7 makes it real.

- [ ] **Step 1:** Write the failing tests:
  - Every row has a numeric `studentCount`, taken from `countActiveByTeacher` (mock it to return `{A:2}` and assert that A shows 2).
  - `q='सुरेश'` finds the teacher by Marathi name. `q='98765'` finds them by mobile.
  - Pagination: `total` is correct, and the order is `joined_at DESC, user_id DESC`.
  - The dashboard counts match the fixtures.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. Add an index `IX_users_role_status_created (role, status, created_at DESC)`. **Step 4:** Run and see it pass.
- [ ] **Step 5:** Commit `feat(admin): teacher list with student counts`.

### Task 2: Block / activate

**Interfaces:** Consumes `tokenService.revokeAllForUser` and `audit`. Produces `adminTeacherService.block(publicId, adminId, reason, ip)` and `.activate(...)`.

- [ ] **Step 1:** Write the failing tests:
  - Block → status `blocked`, the refresh tokens are revoked, an audit row with action `teacher.block` and before/after JSON is written, the teacher gets the notification "Your account has been blocked", and the teacher's next API call → 401.
  - Block with no reason → 400.
  - Activate → status `approved`, plus an audit row.
  - Blocking an already blocked teacher → 409.
  - An admin calling `GET /teacher/courses` → 403.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement in `withTransaction`. **Step 4:** Run and see it pass. **Step 5:** Commit `feat(admin): block and activate teachers`.

### Task 3: Teacher subscriptions

**Interfaces:**
- `teacherSubscriptionService.create({teacherPublicId, planType, startDate, endDate?}, adminId, ip)` and `.update(id, fields, adminId, ip)`
- `planEndDate(planType, startDate) -> Date`
- `requireActiveTeacherSubscription` middleware → 403 `{code:'TEACHER_SUBSCRIPTION_EXPIRED', error:'Your subscription ended on {date}. Contact the admin to renew.'}`
- `jobs/subscriptionReminder.job.js` (daily)

- [ ] **Step 1:** Write the failing tests:
  - `planEndDate('monthly','2026-01-15')` = `2026-02-14`; `quarterly` = `2026-04-14`; `yearly` = `2027-01-14`; `custom` without an endDate → 400.
  - The middleware allows a teacher with an active subscription and blocks an expired one with the exact message. `GET /auth/me` still works for the expired teacher (limited mode, not blocked).
  - The reminder job: a subscription ending in 7 days → teacher + admins notified once; running it again → no duplicates.
  - Create a valid subscription → 201, plus an audit row.
  - End date before start date → 400 "End date must be on or after start date".
  - Overlapping dates for the same teacher → 409.
  - The list shows the computed status `active` / `upcoming` / `expired` and `studentCount`.
  - Update → an audit row with before/after.
  - The teacher gets the notification "Your subscription is set: <start> to <end>".
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. The overlap check uses `UPDLOCK, HOLDLOCK` (mssql.md, "Preventing double-booking"). **Step 4:** Run and see it pass.
- [ ] **Step 5:** Commit `feat(admin): teacher subscription management`.

### Task 4: Notifications (shared) + audit log view

**Interfaces:** Produces `GET /notifications` for any role, scoped to `req.user.id`.

- [ ] **Step 1:** Write the failing tests:
  - A user only sees their own notifications.
  - `read` on someone else's notification → 404.
  - `read-all` sets every one to read.
  - `unread=true` filters correctly.
  - The audit log is admin-only. Filtering by action and date range works.
  - `lms_app` has no UPDATE or DELETE on `admin_audit_log`: run `DENY` in the migration, and assert that an UPDATE fails.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. Add `004a_permissions.sql` with `DENY UPDATE, DELETE ON dbo.admin_audit_log TO lms_app`. **Step 4:** Run and see it pass.
- [ ] **Step 5:** Commit `feat: notifications and audit log`.

### Task 5: Admin web screens

- [ ] **Step 1:** Write failing Vitest tests:
  - The Block button opens a dialog that requires a reason, and the row status updates when it succeeds.
  - The subscription form shows a date error when the end date is before the start date.
  - The notification bell shows the unread count.
- [ ] **Step 2:** Run and see it fail.
- [ ] **Step 3:** Build `AdminLayout` (side nav: Dashboard, Teacher requests, Teachers, Subscriptions, Notifications, Audit log) and the pages:
  - Dashboard: stat tiles linking to the filtered lists.
  - Teachers: table with search/status filter, Block/Activate, link to detail.
  - Teacher detail: profile, subscriptions, student count.
  - Subscriptions: table, Add/Edit modal.
  - Notifications: list, mark read.
  - Audit log: table with filters.
- [ ] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(web): super admin app`.

## Phase done when
- [ ] Tests pass. Manual run: block a logged-in teacher in one browser → their session ends in the other. Add, edit and see a subscription expire.
- [ ] The audit log shows every action from the manual run.
- [ ] Review Focus is covered and `/security-review` is clean.
