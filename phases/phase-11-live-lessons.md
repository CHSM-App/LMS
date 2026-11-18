# Phase 11: Live Lessons Inside Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A module can hold **live** lessons next to recorded ones. A live lesson goes Upcoming → Live now (Join) → Ended → Recorded, and the recording is added to the same lesson.

**Architecture:**
- A live lesson is a `contents` row with `type = 'live'` that points to a `live_classes` row (`contents.live_class_id`). The Meet link, batch, time, attendance and reminders all reuse the live class code. The recording is stored on the content row in the existing `video_source` / `file_key` / `url` columns.
- The stage (upcoming / live / ended / recorded / cancelled) is computed, never stored: one pure function in `api/src/domain/liveLesson.js`.
- Migration `006_live_lessons.sql`. OpenAPI changes go in `docs/openapi-parts/phase11-*.yaml` and are merged with `node docs/openapi-parts/merge.js phase11`.

**Tech Stack:** Same as Phases 5–10 (Express + mssql + Jest/supertest, React + Vite + Vitest, Flutter with `url_launcher` and `video_player`).

**Spec:** `guidelines/DECISIONS.md` → "Live lessons inside modules" (points 1–9). Also the existing "Batch rules" #4 and "Offline video download rules".

## Global Constraints
- Content types become `video`, `pdf`, `link`, `live`. `type` stays `VARCHAR(5)`.
- Live lesson fields: title*, startsAt* (date + time), durationMin (5–600, default 60), meetLink* (auto via `meet.createLink`, else the teacher pastes one), batchId (null = all batches).
- Join window: the Join button shows from **10 minutes before** `startsAt` until `startsAt + durationMin`.
- Reminders for live lessons: **60 and 15 minutes** before start, in-app + WhatsApp (WhatsApp only to opted-in students, as today). Standalone live classes keep their current single 30-minute reminder.
- Recording: `videoSource` is `upload` (with `fileKey`) or `youtube` / `vimeo` / `bunny` (with `url`). Only `upload` recordings are downloadable offline.
- A live lesson can never be a free preview (`isFreePreview` is forced to `false`) and the public catalog never shows its Meet link or recording.
- The Meet link is sent to students only while the lesson is in the Join window or earlier (upcoming); never after it ends.
- All UI text goes through i18n (`en`, `mr`, `hi`). Colours only from design tokens.
- Every new SQL uses parameters, named constraints, and an index on the new FK.

## Review Focus
1. **Teacher reschedules a live lesson** after reminders went out → both reminder flags reset so students get reminded for the new time (test in Task 3).
2. **Teacher deletes a live lesson that already has attendance** → refused with `LIVE_HAS_ATTENDANCE`, nothing deleted (test in Task 3).
3. **Student outside the lesson's batch** opens the course → the live lesson is not listed and its content view returns 404 (test in Task 4).
4. **Cancelled live lesson** → student sees stage `cancelled`, no Join, no Meet link; it still counts as a lesson for progress (test in Task 4).
5. **Recording added as a YouTube link** → the lesson is `recorded` but the download endpoint answers `ONLINE_ONLY` (test in Task 4).

---

### Task 1: Migration and the stage function

**Files:**
- Create: `api/migrations/006_live_lessons.sql`
- Create: `api/src/domain/liveLesson.js`
- Test: `api/tests/unit/liveLesson.test.js`, `api/tests/integration/migrate.test.js` (extend)
- Modify: `docs/ERD.md` (contents.live_class_id, live_classes.reminder2_sent_at)

**Interfaces:**
- Produces: column `dbo.contents.live_class_id INT NULL` (FK `FK_contents_live_class` → `live_classes`, unique filtered index `UQ_contents_live_class` WHERE NOT NULL), column `dbo.live_classes.reminder2_sent_at DATETIME2(3) NULL`.
- Produces: `liveStage({ status, startsAt, durationMin, hasRecording }, now: Date) → 'upcoming' | 'live' | 'ended' | 'recorded' | 'cancelled'` and `JOIN_EARLY_MIN = 10`.

- [ ] **Step 1: Write the failing unit tests** in `api/tests/unit/liveLesson.test.js`:

```js
const { liveStage } = require('../../src/domain/liveLesson');
const at = (iso) => new Date(iso);
const base = { status: 'scheduled', startsAt: at('2026-12-01T12:30:00Z'), durationMin: 60, hasRecording: false };

test('upcoming before the join window', () => expect(liveStage(base, at('2026-12-01T12:19:00Z'))).toBe('upcoming'));
test('live from 10 minutes before start', () => expect(liveStage(base, at('2026-12-01T12:20:00Z'))).toBe('live'));
test('live until the end', () => expect(liveStage(base, at('2026-12-01T13:29:59Z'))).toBe('live'));
test('ended after the end, no recording', () => expect(liveStage(base, at('2026-12-01T13:30:00Z'))).toBe('ended'));
test('recorded once a recording exists, even before the end', () =>
  expect(liveStage({ ...base, hasRecording: true }, at('2026-12-01T13:00:00Z'))).toBe('recorded'));
test('cancelled wins', () => expect(liveStage({ ...base, status: 'cancelled', hasRecording: true }, at('2026-12-01T12:25:00Z'))).toBe('cancelled'));
test('teacher-marked completed counts as ended', () => expect(liveStage({ ...base, status: 'completed' }, at('2026-12-01T12:40:00Z'))).toBe('ended'));
```

- [ ] **Step 2: Run** `cd api && npx jest tests/unit/liveLesson.test.js`. Expected: FAIL, "Cannot find module".
- [ ] **Step 3: Implement `liveStage`** in `api/src/domain/liveLesson.js`. Order: cancelled → recorded → completed/after end → ended → in window → live → else upcoming.
- [ ] **Step 4: Run** the same command. Expected: 7 passed.
- [ ] **Step 5: Extend `migrate.test.js`** with a test that after `migrate()` the columns exist:

```js
test('006 adds live lesson columns', async () => {
  const cols = await query(`SELECT TABLE_NAME t, COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_NAME = 'contents' AND COLUMN_NAME = 'live_class_id') OR (TABLE_NAME = 'live_classes' AND COLUMN_NAME = 'reminder2_sent_at')`);
  expect(cols).toHaveLength(2);
});
```

- [ ] **Step 6: Run** `npx jest tests/integration/migrate.test.js`. Expected: FAIL (0 rows).
- [ ] **Step 7: Write `006_live_lessons.sql`.** Guard every statement with `IF COL_LENGTH(...) IS NULL` / `IF NOT EXISTS (sys.indexes / sys.check_constraints)`. Drop and recreate `CK_contents_type` as `type IN ('video','pdf','link','live')`. Drop and recreate `CK_contents_source` with one more branch: `(type = 'live' AND live_class_id IS NOT NULL AND (video_source IS NULL OR (video_source = 'upload' AND file_key IS NOT NULL) OR (video_source <> 'upload' AND url IS NOT NULL)))`. Add `CK_contents_live_link CHECK (live_class_id IS NULL OR type = 'live')`.
- [ ] **Step 8: Run** `npx jest tests/integration/migrate.test.js tests/integration/teacher/curriculum.test.js`. Expected: all pass (old content still valid).
- [ ] **Step 9: Update `docs/ERD.md`** with the two columns and the FK.
- [ ] **Step 10: Commit** `feat(content): live lesson columns and stage rules`.

---

### Task 2: OpenAPI contract

**Files:**
- Create: `docs/openapi-parts/phase11-paths.yaml`, `docs/openapi-parts/phase11-schemas.yaml`
- Modify: `docs/openapi.yaml` (via merge, plus the `ContentInput` edit by hand)
- Test: `api/tests/integration/openapi.test.js` (already validates the file; must keep passing)

**Interfaces:**
- Produces: `ContentInput` gains `startsAt` (string, date-time), `durationMin` (integer 5–600), `meetLink` (string, nullable), `batchId` (integer, nullable); `type` documented as enum `[video, pdf, link, live]`.
- Produces: `PUT /teacher/contents/{contentId}/recording` body `RecordingInput { videoSource: enum[upload, youtube, vimeo, bunny], fileKey?: string, url?: string }`, and `DELETE /teacher/contents/{contentId}/recording`. Both return the teacher content object.
- Produces: content objects (teacher curriculum, student course view, student content view) may carry `live: { liveClassId, startsAt, durationMin, batch: {id,name}|null, stage, meetLink? }` and `recording: { videoSource, url } | null`.

- [ ] **Step 1:** Write the two part files and edit `ContentInput`.
- [ ] **Step 2: Run** `node docs/openapi-parts/merge.js phase11 && cd api && npx jest tests/integration/openapi.test.js`. Expected: pass.
- [ ] **Step 3: Commit** `docs(api): live lesson contract`.

---

### Task 3: Teacher API — create, edit, record, delete, reminders

**Files:**
- Create: `api/src/services/liveLesson.service.js`
- Modify: `api/src/services/liveClass.service.js` (extract insert, two-step reminders, reset both flags on reschedule)
- Modify: `api/src/services/curriculum.service.js` (`createContent` / `updateContent` / `deleteContent` / `contentOut` delegate for `type === 'live'`)
- Modify: `api/src/routes/teacher.routes.js` (recording routes)
- Test: `api/tests/integration/teacher/liveLessons.test.js`, extend `api/tests/setup/content.js` with `liveLessonBody(overrides)`

**Interfaces:**
- Consumes: `liveStage` (Task 1); `liveClass.targetStudents`; `meet.createLink`; `notifyMany`.
- Produces in `liveClass.service.js`: `insertLiveClass(fields, tx) → liveClassId` (insert + "new class" notification, used by `create` and by live lessons); `runLiveClassReminders()` now sends 30-min reminders for standalone classes and 60/15-min reminders for classes linked to a content row (`reminder_sent_at` = first, `reminder2_sent_at` = second).
- Produces in `liveLesson.service.js`: `createLiveLesson(teacherId, mod, body) → contentOut`, `updateLiveLesson(teacherId, contentId, body) → contentOut`, `setRecording(teacherId, contentId, body) → contentOut`, `clearRecording(contentId) → contentOut`, `deleteLiveLesson(contentId) → { deleted: true }`.
- Live class link for the reminder/notification uses `/student/courses/{courseId}?lesson={contentId}` for live lessons.

- [ ] **Step 1: Write failing tests** in `liveLessons.test.js` (use `readyCourse`, a batch, and `clock` frozen via the existing test clock helper):
  - `creates a live lesson with a pasted Meet link` → 201, `type: 'live'`, `live.stage === 'upcoming'`, `live.batch === null`, `isFreePreview === false` even when the body sends `true`; a `live_classes` row exists with the same `starts_at`.
  - `rejects a time in the past` → 400.
  - `rejects a batch of another course` → 400 `Choose a batch of this course`.
  - `editing the time resets both reminders` → set both flags in SQL, PUT a new `startsAt`, both are `NULL`.
  - `adds an uploaded recording` → `PUT .../recording { videoSource: 'upload', fileKey }` → `recording.videoSource === 'upload'`, stage `recorded`.
  - `adds a YouTube recording` → `{ videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' }` → 200.
  - `recording on a non-live content` → 409 `NOT_LIVE_LESSON`.
  - `deleting a live lesson with attendance is refused` → insert one attendance row, DELETE → 409 `LIVE_HAS_ATTENDANCE`, both rows still exist.
  - `deleting a live lesson without attendance removes the live class too`.
  - `another teacher cannot touch it` → 404.
  - `a course whose only content is a live lesson can be published` (DECISIONS point 8).
  - `the live lesson appears in the teacher's live classes list and its attendance sheet works` (DECISIONS point 6: attendance reuses the live class page).
  - `reminders: 60 then 15 minutes before` → freeze clock at start−59 min, run job, 1 notification per student; run again, none; move to start−14 min, run, a second one; standalone class at start−29 min still gets exactly one.
- [ ] **Step 2: Run** `npx jest tests/integration/teacher/liveLessons.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the service and route changes. Create and delete run in one `withTransaction` (content + live class together). Validation reuses `liveClass.parse` rules (move it to accept `{ courseId }` from the module). Recording validation reuses `uploads.assertOwnedKey(teacherId, key, ['video'])` and `validateVideoLink`.
- [ ] **Step 4: Run** the new test file plus `operations.test.js` and `curriculum.test.js`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(content): teacher live lessons with recordings and reminders`.

---

### Task 4: Student and public API

**Files:**
- Modify: `api/src/services/student.service.js` (`courseView`, `contentView`, `liveClasses`)
- Modify: `api/src/services/download.service.js` (allow `type = 'live'` with an `upload` recording)
- Modify: `api/src/services/publicCatalog.service.js` (live lessons: title + type only)
- Test: extend `api/tests/integration/student/student.test.js`, `student/downloads.test.js`, `public/*.test.js`

**Interfaces:**
- Consumes: `liveStage`; content shape from Task 2.
- Produces: in `courseView` each live content has `live: { startsAt, durationMin, stage }` and `downloadable` is true only for an `upload` recording. Live lessons for another batch are left out. In `contentView` a live content adds `meetLink` only when stage is `upcoming` or `live`, and `url` is the recording (signed if uploaded) when `recorded`.
- `liveClasses(studentId)` rows gain `contentId` (null for standalone) so the dashboard can open the lesson.

- [ ] **Step 1: Write failing tests:**
  - `student sees a live lesson as upcoming without a Meet link in the course view`.
  - `content view has the Meet link during the join window` (clock at start−5 min) `and not after the end` (start+61 min, no recording → stage `ended`, no `meetLink`, no `url`).
  - `student of another batch does not see the lesson` → absent from `courseView`, `contentView` → 404.
  - `cancelled lesson shows stage cancelled and no Meet link`, still counted in `progressPct` denominator.
  - `uploaded recording is downloadable; YouTube recording returns ONLINE_ONLY`.
  - `public course details list the live lesson title and type with no previewUrl`.
- [ ] **Step 2: Run** the three test files. Expected: FAIL.
- [ ] **Step 3: Implement.** Batch filter: `x.live_class_id IS NULL OR l.batch_id IS NULL OR l.batch_id = e.batch_id` (join `live_classes` and the student's enrollment). `contentWithAccess` must apply the same filter.
- [ ] **Step 4: Run** the full API suite `cd api && npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(student): live lessons in course player and downloads`.

---

### Task 5: Web — teacher course builder

**Files:**
- Modify: `web/src/features/teacher/courses/CurriculumTab.jsx`
- Create: `web/src/features/teacher/courses/LiveLessonFields.jsx`, `web/src/features/teacher/courses/RecordingModal.jsx`
- Modify: `web/src/i18n/en.json`, `mr.json`, `hi.json`
- Test: `web/src/features/teacher/courses/__tests__/liveLesson.test.jsx`

**Interfaces:**
- Consumes: Task 2 endpoints.
- Produces: i18n keys under `content.live.*`: `type`, `startsAt`, `duration`, `meetLink`, `meetLinkHint`, `batch`, `allBatches`, `addRecording`, `removeRecording`, `stage.upcoming`, `stage.live`, `stage.ended`, `stage.recorded`, `stage.cancelled`, `recordingSoon`, `join`. Task 6 uses the same keys.

- [ ] **Step 1: Write failing tests:**
  - choosing type "Live" shows date-time, duration, Meet link and batch fields, and hides "free preview".
  - submit posts `{ type: 'live', title, startsAt (ISO, from IST input), durationMin, meetLink, batchId }`.
  - a live lesson row shows a stage badge and an "Add recording" button; the modal offers Upload / YouTube / Vimeo / Bunny and calls `PUT .../recording`.
  - every new key exists in `en`, `mr` and `hi` (extend the existing `i18n.test.js` check if it is not already generic).
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/teacher/courses`. Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `FileUpload` (resumable upload) and `Field`; badge colours from tokens (`upcoming` Blue, `live` Orange, `recorded` Lime, `ended`/`cancelled` Navy tint).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): live lessons in the course builder`.

---

### Task 6: Web — student course player

**Files:**
- Modify: `web/src/features/student/CoursePlayerPage.jsx`
- Create: `web/src/features/student/LiveLessonPanel.jsx`
- Test: `web/src/features/student/__tests__/liveLessonPanel.test.jsx`

**Interfaces:**
- Consumes: student content view from Task 4; i18n keys from Task 5.

- [ ] **Step 1: Write failing tests** for `LiveLessonPanel`, one per stage:
  - `upcoming` → date and time in IST and the batch, no Join button.
  - `live` → Join button that opens `meetLink` in a new tab (`rel="noopener noreferrer"`).
  - `ended` → "Recording coming soon" text.
  - `recorded` → renders `VideoFrame` with the recording URL.
  - `cancelled` → cancelled text, no Join.
- [ ] **Step 2: Run** `npx vitest run src/features/student`. Expected: FAIL.
- [ ] **Step 3: Implement** and use the panel in `CoursePlayerPage` when `type === 'live'`. Lesson list shows the stage badge.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: pass, build OK.
- [ ] **Step 5: Commit** `feat(web): live lessons in the student player`.

---

### Task 7: Mobile — student app

**Files:**
- Modify: `mobile/lib/data/models/student_models.dart` (`LessonLive { startsAt, durationMin, stage, meetLink? }`, `Lesson.live`)
- Modify: `mobile/lib/screens/student/widgets/lesson_row.dart` (stage chip)
- Modify: `mobile/lib/screens/student/course_player_screen.dart` (live panel: Join via `url_launcher` external app, "Recording coming soon", recording via the existing player and download button only when `downloadable`)
- Modify: `mobile/lib/l10n/app_en.arb`, `app_mr.arb`, `app_hi.arb`. ARB keys are camelCase with the student `s` prefix (no dots): `sLiveUpcoming`, `sLiveNow`, `sLiveEnded`, `sLiveRecorded`, `sLiveCancelled`, `sLiveJoin`, `sLiveRecordingSoon`, `sLiveStartsAt` (placeholder `{when}`). Same meanings as the web `content.live.*` keys in Task 5.
- Test: `mobile/test/student/live_lesson_test.dart`

- [ ] **Step 1: Write failing tests:** model parses `live` JSON (and `null`); `LessonRow` shows the right chip text per stage; the player shows a Join button only for stage `live` and no download button for a YouTube recording.
- [ ] **Step 2: Run** `cd mobile && flutter test test/student/live_lesson_test.dart`. Expected: FAIL.
- [ ] **Step 3: Implement.** Colours from the theme built from `design-tokens/tokens.json`.
- [ ] **Step 4: Run** `flutter analyze && flutter test`. Expected: no issues, all pass.
- [ ] **Step 5: Commit** `feat(mobile): live lessons in the student course player`.

---

### Task 8: Demo seed and wrap-up

**Files:**
- Modify: `api/scripts/seed-demo.js` (demo course: one upcoming live lesson tomorrow 18:00 IST, one past live lesson with a YouTube recording)
- Test: `api/tests/integration/seedDemo.test.js` (assert 2 `type = 'live'` contents, one with `video_source` set)
- Modify: `phases/README.md` (add row 11), this file's checkboxes

- [ ] **Step 1: Write the failing seed assertion**, run `npx jest tests/integration/seedDemo.test.js` → FAIL.
- [ ] **Step 2: Extend the seed** (idempotent, like the existing lesson loop). Past lessons are inserted with SQL because the API refuses past times.
- [ ] **Step 3: Run** the seed test → PASS, then the full suites: `cd api && npm test`, `cd web && npm test`, `cd mobile && flutter analyze && flutter test`.
- [ ] **Step 4:** Run `/security-review` on the branch.
- [ ] **Step 5: Commit** `chore(seed): demo live lessons`.

## Phase done when
- [ ] A teacher can add a live lesson to a module, edit its time, add/remove a recording, and delete it (when no attendance).
- [ ] Students of the right batch see Upcoming → Join → "Recording coming soon" → recording, on web and in the app.
- [ ] Reminders go out 60 and 15 minutes before a live lesson; standalone classes still get one at 30.
- [ ] Uploaded recordings download offline; link recordings are online only.
- [ ] The public course page shows live lesson titles with no link.
- [ ] All API, web and mobile tests pass; `/security-review` is clean.
