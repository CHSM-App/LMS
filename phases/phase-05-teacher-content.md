# Phase 5: Teacher Courses, Subjects, Modules, Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher build a full course: course → subjects → modules → content items (video/PDF/link), with uploads, ordering, free preview and the Draft/Pending/Published lifecycle.

**Architecture:**
- Migration `002_content.sql`.
- Every teacher route uses `authorize('teacher')` + `ownsCourse` (it resolves the course from the param and checks `teacher_id = req.user.id`; otherwise 404, so other teachers' IDs aren't revealed).
- Files go through `providers/storage` with signed URLs.

**Tech Stack:** multer, file-type, uuid; React Hook Form; drag-to-reorder with `@dnd-kit/sortable`.

**Spec:** spec §4 Teacher (Create/edit course, Subject, Module, Content per module), §6 (demo videos public).

## Global Constraints
- Course fields: title*, description*, subject*, language*, thumbnail*, duration, fee (display only), demo video 1*, demo video 2*, status (Draft / Pending / Published).
- **Exactly 2 demo videos** per course.
- Subject fields: name*, course*, description. Module fields: name*, subject*, order number.
- Content fields: title*, type (video / PDF / link)*, file or URL*, order, free preview.
- Demo videos can be watched without login.
- A blocked teacher cannot create or edit anything (403 "Your account is blocked").
- The fee is shown on the page only; there is no payment anywhere.
- **Status flow (DECISIONS.md): `draft → published` only.** ⏸️ `pending` stays in the CHECK constraint but is not used in v1. You can publish only when the required fields, both demo videos and ≥1 module with ≥1 content item are present. Going back to `draft` hides the course from the public.
- **Publishing needs an active teacher subscription** (`requireActiveTeacherSubscription`, Phase 4). Editing drafts is allowed in limited mode.
- **Videos (DECISIONS.md): link OR upload** for each demo video and each video content item. Link providers: YouTube (unlisted), Vimeo, Bunny Stream, validated by URL pattern. Uploads are **chunked + resumable** (5 MB chunks, resume after a network drop), with a progress bar.

## Review Focus
1. **Teacher B opens teacher A's course ID** (GET, PUT, add module) → 404 every time. Task 1 ownership test, run for every route.
2. **Publishing a course with only 1 demo video or no content** → 422 listing what's missing. Task 1.
3. **Reordering modules or content with a stale order** (two tabs): the final order is consistent with no duplicate order numbers. Task 3 (the whole order is saved in one transaction).
4. **Deleting a module that already has content:** blocked with 409 "Remove or move its content first". Questions that reference it are handled in Phase 6. Task 3.
5. **Uploading a `.exe` renamed to `.mp4`** → 400 (magic bytes). Task 4.

## Data (002_content.sql)
- `courses(course_id, public_id, teacher_id FK users, title NVARCHAR(200), slug VARCHAR(220) UNIQUE, description NVARCHAR(MAX), subject NVARCHAR(120), language CHAR(2), thumbnail_key VARCHAR(200), duration_text NVARCHAR(60), fee_display NVARCHAR(60), demo_video1_source VARCHAR(8) CHECK IN ('upload','youtube','vimeo','bunny'), demo_video1_ref VARCHAR(500) /*file key or URL*/, demo_video2_source, demo_video2_ref, status VARCHAR(10) CHECK IN ('draft','pending','published') /*pending unused in v1*/, published_at, created_at, updated_at, row_ver)` with an index on `(teacher_id, status)` and a filtered index on `(status, published_at DESC) WHERE status='published'`.
- `subjects(subject_id, course_id FK, name NVARCHAR(120), description NVARCHAR(1000), sort_order INT)`
- `modules(module_id, subject_id FK, course_id FK (denormalized for ownership checks), name NVARCHAR(160), sort_order INT)` with a unique `(subject_id, sort_order)`.
- `contents(content_id, module_id FK, course_id FK, title NVARCHAR(200), type VARCHAR(5) CHECK IN ('video','pdf','link'), video_source VARCHAR(8) NULL CHECK IN ('upload','youtube','vimeo','bunny'), file_key VARCHAR(200) NULL, url VARCHAR(500) NULL, sort_order INT, is_free_preview BIT DEFAULT 0, CHECK ((type='link' AND url IS NOT NULL) OR (type='pdf' AND file_key IS NOT NULL) OR (type='video' AND ((video_source='upload' AND file_key IS NOT NULL) OR (video_source<>'upload' AND url IS NOT NULL)))))`
- `batches(batch_id, course_id FK, name NVARCHAR(80), start_date DATE, end_date DATE NULL, timing_text NVARCHAR(80), max_students INT NULL, status VARCHAR(8) CHECK IN ('active','closed'), UNIQUE(course_id, name))`. Batch rules are in DECISIONS.md.
- `upload_sessions(upload_id UNIQUEIDENTIFIER, teacher_id FK, kind, file_name NVARCHAR(200), total_bytes BIGINT, received_bytes BIGINT, status VARCHAR(10) CHECK IN ('open','complete','aborted'), file_key NULL, created_at, expires_at)`: resumable uploads; open sessions are cleaned up after 24 hours.

## Endpoints (all `/teacher/...`, owner only)
| Method | Path | Notes |
|---|---|---|
| GET/POST | /teacher/courses | list own · create (status `draft`) |
| GET/PUT/DELETE | /teacher/courses/:courseId | delete only when `draft` and no enrollments |
| POST | /teacher/courses/:courseId/status | `{status}`; publish runs the readiness check |
| GET/POST | /teacher/courses/:courseId/subjects | |
| PUT/DELETE | /teacher/subjects/:subjectId | |
| GET/POST | /teacher/subjects/:subjectId/modules | |
| PUT/DELETE | /teacher/modules/:moduleId | |
| PUT | /teacher/subjects/:subjectId/modules/order | `{moduleIds:[...]}` |
| GET/POST | /teacher/modules/:moduleId/contents | multipart for video/pdf |
| PUT/DELETE | /teacher/contents/:contentId | |
| PUT | /teacher/modules/:moduleId/contents/order | `{contentIds:[...]}` |
| POST | /uploads | small files (thumbnail, pdf): `{kind}` + file → `{key}` |
| POST | /uploads/sessions | videos: `{kind, fileName, totalBytes}` → `{uploadId, chunkSize}` |
| PUT | /uploads/sessions/:uploadId | chunk with a `Content-Range` header → `{receivedBytes}` |
| GET | /uploads/sessions/:uploadId | `{receivedBytes}` (to resume) |
| POST | /uploads/sessions/:uploadId/complete | magic-byte check → `{key}` |
| GET | /files/:key | signed-URL access; `demo_video` and `thumbnail` are public |

## File Structure
```
api/migrations/002_content.sql
api/src/providers/storage/{index,local}.js
api/src/middlewares/{ownsCourse,upload}.js
api/src/services/{course,subject,module,content}.service.js
api/src/repositories/{course,subject,module,content}.repo.js
api/src/controllers/teacher/{course,subject,module,content,upload}.controller.js
api/src/routes/teacher.routes.js, files.routes.js
api/tests/integration/teacher/{courses,subjects,modules,contents,uploads,ownership}.test.js
web/src/app/layouts/TeacherLayout.jsx
web/src/features/teacher/{courses,course-builder}/*
```

---

### Task 1: Courses + ownership + publish rules

**Interfaces:**
- Produces `ownsCourse(paramName)` middleware, which sets `req.course`.
- Produces `courseService.create(teacherId, fields)`, `.update(...)`, `.setStatus(courseId, status)` and `.readiness(courseId) -> { ready:boolean, missing:string[] }`.

- [x] **Step 1:** Write the failing tests:
  - Create without `thumbnail` → 400.
  - Create valid → 201 with status `draft` and a slug made from the title (Marathi titles transliterate or fall back to a short id).
  - Teacher B GET/PUT/DELETE/status on A's course → 404.
  - Publish with 1 demo video → 422 `{missing:['demo_video_2','content']}`.
  - Publish when ready → `published`, with `published_at` set.
  - A blocked teacher creating a course → 403.
  - Deleting a published course → 409 "Unpublish the course first".
- [x] **Step 2:** Run and see it fail. **Step 3:** Implement. **Step 4:** Run and see it pass. **Step 5:** Commit `feat(teacher): courses with ownership and publish rules`.

### Task 2: Subjects

- [x] **Step 1:** Write the failing tests: CRUD under your own course works. Another teacher's course → 404. A missing name → 400. Deleting a subject that has modules → 409.
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): subjects`.

### Task 3: Modules + ordering

**Interfaces:** Produces `moduleService.reorder(subjectId, moduleIds)`. It validates that the set equals the subject's modules exactly, then rewrites `sort_order` 1..n in one transaction.

- [x] **Step 1:** Write the failing tests:
  - A new module gets `sort_order = max+1`.
  - Reorder with the full list → the order is saved.
  - Reorder with a missing or foreign id → 400.
  - Two reorders in parallel → the final orders are unique 1..n.
  - Deleting a module that has content → 409 "Remove or move its content first".
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): modules and ordering`.

### Task 4: Storage + uploads + content

**Interfaces:**
- Produces `storage.save(file, kind) -> key`, `storage.signedUrl(key, ttlSec=600) -> url` and `storage.stream(key)`.
- Produces `contentService.create(moduleId, {title, type, fileKey|url, isFreePreview})` and `.reorder(moduleId, contentIds)`.

- [x] **Step 1:** Write the failing tests:
  - Upload a real mp4 in 3 chunks → `{key}`. Stop after chunk 1, `GET` the session → `receivedBytes` = chunk size, then resume → complete.
  - A chunk with the wrong `Content-Range` offset → 409 with the current `receivedBytes`.
  - A `.exe` renamed to `.mp4` → 400 "File type not allowed" at `complete`.
  - A video by link: `https://youtu.be/abc` → `youtube`, accepted. `https://example.com/v.mp4` with source `youtube` → 400 "Enter a valid YouTube link".
  - Publish while the teacher's subscription has expired → 403 `TEACHER_SUBSCRIPTION_EXPIRED`. Saving a draft is still allowed.
  - A PDF over 20 MB → 413.
  - A `link` content item with no URL → 400. A `video` content item with no fileKey → 400.
  - `GET /files/:key` for a course video without a valid signature → 403.
  - A demo video can be fetched without login.
  - Content reorder follows the same rules as Task 3.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Implement the local storage at `STORAGE_DIR/<kind>/<uuid>.<ext>`. The signature is an HMAC of `key|exp`. Video responses support HTTP Range (streaming).
- [x] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(teacher): uploads and module content`.

### Task 4b: Batches (per course)

**Interfaces:** `batchService.create(courseId, {name, startDate, endDate?, timingText?, maxStudents?})`, `.update`, `.close`. Endpoints: `GET/POST /teacher/courses/:courseId/batches`, `PUT /teacher/batches/:batchId`.

- [x] **Step 1:** Write the failing tests:
  - Create → 201 with status `active`. A duplicate name in the same course → 409.
  - End date before start date → 400.
  - Another teacher's course → 404.
  - Closing a batch is allowed; closed batches can't take new students (checked in Phase 7).
- [x] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(teacher): course batches`.

### Task 5: Teacher web: course list + course builder

- [x] **Step 1:** Write failing Vitest tests:
  - The course form blocks submit without both demo videos.
  - The Publish button shows the missing items from `readiness`.
  - Dragging modules calls the reorder API with the new id list.
- [x] **Step 2:** Run and see it fail.
- [x] **Step 3:** Build:
  - `TeacherLayout`, with nav: Dashboard, Courses, Question bank, Exams, Live classes, Requests, Students, Attendance, Doubts, Programs, Profile, Notifications. Items for later phases are hidden until they're built.
  - `/teacher/courses`: table with status badges and New course.
  - `/teacher/courses/:id`: tabs Details (form with all course fields; each video has a "Link | Upload" toggle, with `UploadProgress` for resumable uploads and a `VideoFrame` preview), **Batches** (list + add/edit/close), and Curriculum (subjects → modules → content tree with add/edit/delete, drag to reorder, free-preview toggle). A Publish/Unpublish action.
- [x] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(web): teacher course builder`.

## Phase done when
- [x] Tests pass. Manual run: a teacher builds a course with 2 subjects, 3 modules, video + PDF + link content, and publishes it. A second teacher cannot see or touch it. — **Automated** in `web/e2e/` (23 Playwright specs, 2026-11-18).
- [x] Review Focus is covered and `/security-review` is clean. — **Self-review** 2026-11-18 (the `/security-review` command needs a git remote; findings fixed: auth before validation, role matrix, security logging, token grace).
