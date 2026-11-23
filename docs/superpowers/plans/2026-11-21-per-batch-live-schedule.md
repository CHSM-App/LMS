# Per-batch live schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One course keeps one set of modules and lessons for every year. A live lesson gets its own date, Meet link, attendance and recording **per batch**, so a new batch ("2027 - Batch A") only needs new live dates, not a new course.

**Architecture:** A live lesson becomes a **slot**: all `contents` rows (type `live`) that share one `live_slot_id` are the same lesson in different batches. Each row keeps its existing 1:1 `live_classes` row (time, batch, Meet link, attendance, reminders) and its own recording columns. Students already see only the rows for their batch (`visibleSql` in `api/src/services/studentAccess.js`), so the student side needs no query change, only tests. The teacher side collapses the rows of a slot into one lesson with a `sessions[]` list and gets a "schedule a batch" action plus a bulk "Live schedule" screen.

**Tech Stack:** Express + SQL Server (`api/`), React + Vite (`web/`), existing Jest/Vitest suites.

**Spec:** `guidelines/DECISIONS.md` (section "Live lessons inside modules", plus the new section written in Task 1). DECISIONS.md wins over the spec.

## Global Constraints

- API base `/api/v1`; response `{ success, data }` or `{ success:false, error }`.
- `docs/openapi.yaml` is updated **before** any endpoint changes (`api/tests/integration/openapi.test.js` enforces it).
- DB: named constraints, an index on every FK, UTC `DATETIME2(3)` with `SYSUTCDATETIME()`, parameterized queries only, NVARCHAR for typed text. Migrations are idempotent (`IF NOT EXISTS`), next file is `010_*.sql`.
- Roles `admin`, `teacher`, `student`; owner checks go through `owns()` / `owned()`.
- UI text via i18n keys in `en`, `mr`, `hi`; colours only from `design-tokens/tokens.json`; light theme only.
- Join window stays 10 minutes before start until the end; WhatsApp links to the app page, never to Meet.
- Batch names are free text chosen by the teacher. Recommend the year in the name ("2027 - Batch A"); no new uniqueness rule.
- Mobile numbers `+91XXXXXXXXXX`; no hard-coded colours or strings.

## Review Focus

- Batch B student must **never** see Batch A's recording, before or after B's own class (test in Task 4).
- A batch cannot get two sessions of the same slot (second schedule call is rejected, no half-created rows).
- A slot with an "all batches" session cannot also get single-batch sessions (and the reverse): reject with a clear code.
- Reordering, renaming or moving a lesson changes every row of its slot, so batches never drift apart.
- Deleting a session that has attendance is refused (existing rule); deleting a whole slot that has any attendance is refused and nothing is deleted.
- A closed batch cannot be scheduled.
- Existing 2026 data keeps working: every existing live lesson becomes its own slot with no visible change.

---

### Task 1: Write the rules first (docs)

**Files:**
- Modify: `guidelines/DECISIONS.md` (new section "Live lessons per batch (confirmed 2026-11-21)")
- Modify: `docs/openapi.yaml`, `docs/ERD.md`
- Modify: `phases/phase-11-live-lessons.md` (add the new steps as unticked checkboxes)

**Interfaces:**
- Produces: the endpoint contracts used by Tasks 3 to 6:
  - `POST /teacher/contents/{contentId}/sessions` body `{ batchId, startsAt, durationMin?, meetLink? }` → the new session `{ contentId, liveClassId, batch, startsAt, durationMin, stage, meetLink }`. Errors: `SESSION_EXISTS`, `SLOT_ALL_BATCHES`, `BATCH_CLOSED`, `PAST_TIME`.
  - `POST /teacher/courses/{courseId}/batches/{batchId}/live-schedule` body `{ items: [{ slotId, startsAt, durationMin?, meetLink? }] }` → `{ created: n, sessions: [...] }`; all-or-nothing.
  - Teacher curriculum live content gains `live.slotId` and `live.sessions[]` (one per batch: `{ contentId, liveClassId, batch, startsAt, durationMin, stage, meetLink, recording }`); the old `live` and `recording` fields describe the first session so older clients keep working.

- [ ] **Step 1:** Write the DECISIONS.md section from the points in this plan's Goal and Architecture, with the student view table (Upcoming / Live now / Ended / Recorded per batch) and the rule "a batch never sees another batch's recording".
- [ ] **Step 2:** Add the two endpoints and the new curriculum fields to `docs/openapi.yaml`; add `live_slot_id` to the `contents` table in `docs/ERD.md`.
- [ ] **Step 3:** Run `cd api && npx jest tests/integration/openapi.test.js` → expect PASS.
- [ ] **Step 4:** Commit `docs(live): per-batch live schedule rules and API contract`.

### Task 2: Migration `010_live_slots.sql`

**Files:**
- Create: `api/migrations/010_live_slots.sql`
- Test: `api/tests/integration/migrate.test.js`

**Interfaces:**
- Produces: `dbo.contents.live_slot_id UNIQUEIDENTIFIER NULL`, index `IX_contents_live_slot` on `(live_slot_id) WHERE live_slot_id IS NOT NULL`, check `CK_contents_live_slot` = `live_slot_id IS NULL OR type = 'live'`. Every existing live row is backfilled with its own `NEWID()`.

- [ ] **Step 1:** In `migrate.test.js` add the failing test "contents.live_slot_id exists, every live row has one, non-live rows have none, and running the migration twice changes nothing".
- [ ] **Step 2:** Run `cd api && npx jest tests/integration/migrate.test.js` → expect FAIL.
- [ ] **Step 3:** Write the migration (add column, backfill `UPDATE dbo.contents SET live_slot_id = NEWID() WHERE type = 'live' AND live_slot_id IS NULL`, index, check), all guarded by `IF NOT EXISTS`/`COL_LENGTH`.
- [ ] **Step 4:** Run `cd api && npm run migrate && npx jest tests/integration/migrate.test.js` → expect PASS.
- [ ] **Step 5:** Commit `feat(db): live_slot_id groups the batch sessions of one live lesson`.

### Task 3: Service `scheduleBatchSession`

**Files:**
- Modify: `api/src/services/liveLesson.service.js` (new signature below; `createLiveLesson` also sets a fresh `live_slot_id`)
- Modify: `api/src/routes/teacher.routes.js` (route from Task 1)
- Test: `api/tests/integration/teacher/liveLessons.test.js`

**Interfaces:**
- Produces: `scheduleBatchSession(teacherId, content, { batchId, startsAt, durationMin, meetLink }) → { contentId }` where `content` is the row from `curriculum.loadContent`. It inserts a new `contents` row (same module, title, `sort_order`, `is_free_preview`, same `live_slot_id`, no recording) linked to a new `live_classes` row via `liveClass.parse` and `liveClass.insertLiveClass`, then calls `liveClass.notifyNewClass` for that batch, all in one transaction.
- Consumes: `liveClass.parse`, `insertLiveClass`, `notifyNewClass`, `lessonLink` (`api/src/services/liveClass.service.js`).

- [ ] **Step 1:** Write failing tests: (a) schedule Batch B on a lesson that has a Batch A session → 201, two rows share one `live_slot_id`, B row has no recording; (b) same batch twice → 409 `SESSION_EXISTS`; (c) lesson whose session is for all batches (`batch_id` NULL) → 409 `SLOT_ALL_BATCHES`; (d) closed batch → 409 `BATCH_CLOSED`; (e) time in the past → 400; (f) another teacher's content → 404.
- [ ] **Step 2:** Run `npx jest tests/integration/teacher/liveLessons.test.js` → expect FAIL.
- [ ] **Step 3:** Implement `scheduleBatchSession`; `createLiveLesson` generates `live_slot_id` with `NEWID()` in its INSERT. Re-check the "one session per batch per slot" rule inside the transaction with `UPDLOCK, HOLDLOCK` on the slot's rows.
- [ ] **Step 4:** Run the same test file → expect PASS.
- [ ] **Step 5:** Commit `feat(live): schedule a batch session on an existing live lesson`.

### Task 4: Student isolation tests (no code change expected)

**Files:**
- Test: `api/tests/integration/student/liveLessons.test.js`

- [ ] **Step 1:** Write the tests: course with one slot, sessions for Batch A and Batch B, A recording added, A class ended. Assert: Batch A student sees stage `recorded` with the recording; Batch B student sees stage `upcoming`, the same module and position, **no** recording URL and no Meet link; after B's class ends without a recording B sees `ended`; after B adds its own recording B gets B's recording URL, never A's; a student of neither batch sees no session; the downloads endpoint refuses A's recording for B (`api/src/services/download.service.js`).
- [ ] **Step 2:** Run `npx jest tests/integration/student/liveLessons.test.js`. Expect PASS. If any assertion fails, fix the query in `student.service.js` / `studentAccess.js` / `download.service.js` and commit the fix separately.
- [ ] **Step 3:** Commit `test(live): a batch never sees another batch's live recording`.

### Task 5: Teacher curriculum shows one lesson with sessions; edits apply to the whole slot

**Files:**
- Modify: `api/src/services/curriculum.service.js` (`curriculum`, `contentOut`, `updateContent`, `deleteContent`, `reorder`), `api/src/services/liveLesson.service.js` (`updateLiveLesson` title propagation, `deleteLiveLesson`)
- Test: `api/tests/integration/teacher/curriculum.test.js`, `liveLessons.test.js`

**Interfaces:**
- Produces: `curriculum(courseId)` returns one content entry per slot (the row with the lowest `content_id`), with `live.slotId` and `live.sessions[]` as defined in Task 1. `deleteLiveSlot(content)` removes every session of the slot or refuses with `LIVE_HAS_ATTENDANCE` before deleting anything.
- Per-session actions (recording set/clear, Meet link, time change, cancel) stay on the session's own `contentId` and `liveClassId`; no signature changes.

- [ ] **Step 1:** Failing tests: (a) curriculum returns one entry for a slot with two sessions and the sessions list has both batches; (b) renaming the lesson changes the title of all rows; (c) reorder moves all rows of the slot to the same `sort_order`; (d) deleting the slot with attendance on any session → 409 and both rows still exist; (e) deleting a slot with no attendance deletes all rows and live classes.
- [ ] **Step 2:** Run both test files → expect FAIL.
- [ ] **Step 3:** Implement: group rows by `live_slot_id` in `curriculum`; propagate title and `sort_order` and module moves to rows with the same `live_slot_id`; implement `deleteLiveSlot` in one transaction.
- [ ] **Step 4:** Run both test files and the whole API suite `cd api && npm test` → expect PASS.
- [ ] **Step 5:** Commit `feat(live): the teacher sees one lesson with a session per batch`.

### Task 6: Bulk "Live schedule" for a new batch

**Files:**
- Modify: `api/src/services/liveLesson.service.js`, `api/src/routes/teacher.routes.js`
- Test: `api/tests/integration/teacher/liveLessons.test.js`

**Interfaces:**
- Produces: `scheduleBatch(teacherId, courseId, batchId, items) → { created, sessions }` using `scheduleBatchSession` per item inside **one** transaction (all-or-nothing). Items whose slot already has a session for that batch fail the whole call with `SESSION_EXISTS` naming the slot.
- Also produces `GET /teacher/courses/{courseId}/batches/{batchId}/live-schedule` → every slot of the course with that batch's session or `null` (drives the screen in Task 7). Add it to `docs/openapi.yaml` in the same commit.

- [ ] **Step 1:** Failing tests: two slots, new batch, two items → both created; one invalid item (past time) → nothing created; the GET lists both slots, with `session: null` before and filled after.
- [ ] **Step 2:** Run the test file → expect FAIL.
- [ ] **Step 3:** Implement `scheduleBatch` and the GET handler (query slots by `live_slot_id` for the course, left-join the batch's session).
- [ ] **Step 4:** Run `cd api && npm test` → expect PASS.
- [ ] **Step 5:** Commit `feat(live): schedule every live lesson of a course for a new batch in one go`.

### Task 7: Web, teacher "Live schedule" screen and curriculum sessions

**Files:**
- Create: `web/src/features/teacher/courses/LiveSchedulePage.jsx` and its test `web/src/features/teacher/courses/__tests__/liveSchedule.test.jsx`
- Modify: `web/src/features/teacher/courses/LiveLessonFields.jsx` (show sessions per batch and an "Add batch" action), the teacher routes file under `web/src/`, and the i18n files for `en`, `mr`, `hi`
- Modify: `web/src/components/LiveStageBadge.jsx` only if a new stage label is needed (none expected)

**Interfaces:**
- Consumes: the two endpoints and the curriculum shape from Tasks 1, 5, 6.

- [ ] **Step 1:** Failing component tests: the page lists every live lesson of the course for the chosen batch with date, time and Meet-link inputs; "Save schedule" posts one request with all filled rows; rows left empty are skipped; a server error (`SESSION_EXISTS`) shows its message and nothing is marked saved; the curriculum row shows one lesson with one badge per batch session.
- [ ] **Step 2:** Run `cd web && npx vitest run src/features/teacher/courses` → expect FAIL.
- [ ] **Step 3:** Implement the page and the lesson-row changes; reach the page from the batch screen ("Set live schedule" button) and the course screen; all strings come from i18n keys in the three languages; colours only from tokens.
- [ ] **Step 4:** Run `cd web && npm test && npm run build` → expect PASS and a clean build.
- [ ] **Step 5:** Commit `feat(web): live schedule screen for a batch`.

### Task 7b: Date optional (template row) and "Schedule coming soon"

**Files:**
- Create: `api/migrations/011_live_lesson_template.sql`
- Modify: `api/src/services/liveLesson.service.js` (`createLiveLesson`), `api/src/services/studentAccess.js` (`visibleSql`, `isVisible`), `api/src/services/student.service.js` (`liveSummary`), `api/src/domain/liveLesson.js`
- Test: `api/tests/integration/migrate.test.js`, `teacher/liveLessons.test.js`, `student/liveLessons.test.js`, `api/tests/unit` for `liveStage`

**Interfaces:**
- Produces: a live lesson may be created with only `title` (no `startsAt`, no `batchId`). It is stored as a **template row**: `type = 'live'`, `live_class_id IS NULL`, own `live_slot_id`. `CK_contents_source` is relaxed so a live row has `live_class_id` or is a template row. `liveStage` returns `'unscheduled'` for a template row.
- Rule for students: a template row is visible to a student only if no other row of the same slot has a session visible to that student's batch; it shows stage `unscheduled` ("Schedule coming soon"), has no Join button and cannot be marked complete. Counts (`total_lessons`, `done_lessons`, next lesson) count one lesson per slot per student.
- `scheduleBatchSession` on a template row **converts** it into the first session (no extra row) so a slot never keeps a stale template.

- [ ] **Step 1:** Failing tests: create live lesson with title only → 201 and stage `unscheduled`; student of any batch sees it as `unscheduled` with no Join; after Batch A is scheduled, A sees `upcoming`, Batch B (not scheduled yet) still sees `unscheduled`, not A's date; progress percentages count the lesson once; unit test `liveStage` → `'unscheduled'`.
- [ ] **Step 2:** Run the listed test files → expect FAIL.
- [ ] **Step 3:** Write migration 011 (relax `CK_contents_source` and `CK_contents_live_link`), update `createLiveLesson` to accept title-only, update the student visibility rule and `liveSummary`.
- [ ] **Step 4:** Run `cd api && npm test` → expect PASS.
- [ ] **Step 5:** Commit `feat(live): a live lesson can be created without a date; students see "Schedule coming soon"`.

### Task 7c: Mobile (Flutter), same behaviour as web

**Files:**
- Modify: `mobile/lib/data/models/student_models.dart` (live stage `unscheduled`), `mobile/lib/screens/student/widgets/lesson_row.dart`, `mobile/lib/screens/student/course_player_screen.dart`, `mobile/lib/l10n/app_en.arb`, `app_mr.arb`, `app_hi.arb` (key `liveScheduleSoon`)
- Modify: `mobile/lib/data/models/teacher_models.dart`, `mobile/lib/data/repositories/teacher_repository.dart`, `mobile/lib/presentation/providers/teacher_providers.dart`, `mobile/lib/screens/teacher/teacher_tabs.dart`
- Create: `mobile/lib/screens/teacher/live_schedule_screen.dart`
- Test: `mobile/test/student/*`, `mobile/test/teacher/live_schedule_test.dart`

**Interfaces:**
- Consumes: `GET` and `POST /teacher/courses/{courseId}/batches/{batchId}/live-schedule` (Task 6).
- Produces: `LiveScheduleScreen(courseId, batchId)` lists every live lesson of the course for that batch (title, date, time, Meet link), saves all filled rows in one call; student lesson row shows "Schedule coming soon" for stage `unscheduled`, no Join button.

- [ ] **Step 1:** Failing widget tests: student lesson row for stage `unscheduled` shows the localized text and no Join; teacher screen lists lessons, a row left empty is not sent, a server error shows its message.
- [ ] **Step 2:** Run `cd mobile && flutter test test/student test/teacher` → expect FAIL.
- [ ] **Step 3:** Implement models, repository calls, provider, screen and the three ARB strings (generated l10n regenerated with `flutter gen-l10n`); colours from the existing theme tokens only.
- [ ] **Step 4:** Run `cd mobile && flutter analyze && flutter test` → expect no issues and PASS.
- [ ] **Step 5:** Commit `feat(mobile): per-batch live schedule and "Schedule coming soon"`.

### Task 8: Seed demo and end-to-end check

**Files:**
- Modify: `api/scripts/seed-demo.js`, `api/tests/integration/seedDemo.test.js`

- [ ] **Step 1:** Failing test: the demo course has one live lesson with sessions for two batches, the student of each batch sees only their own.
- [ ] **Step 2:** Run `cd api && npx jest tests/integration/seedDemo.test.js` → expect FAIL.
- [ ] **Step 3:** Update the seed to create the second batch session through `scheduleBatchSession`.
- [ ] **Step 4:** Run `cd api && npm test && cd ../web && npm test` → expect everything PASS; then start the app (`npm run dev` in `api/` and `web/`) and walk through: create batch "2027 - Batch A", open Live schedule, fill dates, log in as a student of that batch, see Upcoming with the right date and the same modules.
- [ ] **Step 5:** Tick the finished boxes in `phases/phase-11-live-lessons.md`; commit `chore(live): seed and tick phase 11 steps`.

---

## Self-review

- **Spec coverage:** same modules every year (slot model), per-batch date/Meet/recording/attendance (Tasks 3, 5), no cross-batch recordings (Task 4), bulk schedule for a new batch (Task 6, 7), year in the batch name (Global Constraints, no code), old 2026 data intact (Task 2 backfill).
- **Out of scope:** copying a whole course (rejected by the owner), a "previous batch recording" option (owner said no), mobile teacher screens (teacher side is web only; student screens are unchanged).
- **Types:** `live_slot_id`, `slotId`, `sessions[]`, `scheduleBatchSession`, `scheduleBatch`, `deleteLiveSlot` are used with the same names in every task.
