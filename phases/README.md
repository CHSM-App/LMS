# Phases

Run the phases in order. Each file is a step-by-step implementation plan: tasks → checkbox steps → tests → commit.
Before starting any phase, read `CLAUDE.md` and `guidelines/README.md`.

| # | File | Delivers | Depends on |
|---|---|---|---|
| 1 | [phase-01-architecture.md](phase-01-architecture.md) | Repo, API skeleton, ERD, core DB migration, OpenAPI, roles matrix, i18n, BACKEND_NEEDS | – |
| 2 | [phase-02-design-system.md](phase-02-design-system.md) | Design tokens, web components, Flutter theme + widgets | 1 |
| 3 | [phase-03-auth.md](phase-03-auth.md) | OTP login, tokens, teacher onboarding, admin approve/reject, **consent, change mobile, delete account, legal pages** | 1, 2 |
| 4 | [phase-04-super-admin.md](phase-04-super-admin.md) | Admin app: teachers, block/activate, **plan-based** subscriptions, **limited mode + expiry reminders**, notifications, audit log | 3 |
| 5 | [phase-05-teacher-content.md](phase-05-teacher-content.md) | Courses (Draft → Published), subjects, modules, content, **video link or resumable upload**, **batches** | 3, 4 |
| 6 | [phase-06-teacher-exams.md](phase-06-teacher-exams.md) | Question bank, Excel import, exam builder (**batch targeting**), results engine | 5 |
| 7 | [phase-07-teacher-operations.md](phase-07-teacher-operations.md) | Live classes, demo/enrollment requests (**batch on approve**, WhatsApp API + fallback), students, attendance, doubts, access, profile, **light teacher app** | 5 |
| 8 | [phase-08-public-site.md](phase-08-public-site.md) | Public course list, course details, live demo request (**consent**), footer | 5, 7 |
| 9 | [phase-09-student.md](phase-09-student.md) | Enrollment, dashboard, player (**online streaming**), exams, results, doubts, progress (**batch-aware**), **offline download licences API** | 6, 7, 8 |
| 10 | [phase-10-notifications-flutter-release.md](phase-10-notifications-flutter-release.md) | Notifications, **student app** completion + **offline video downloads (encrypted, no sharing)**, full tests, Plesk build, **Play Store / WhatsApp / DLT compliance** | all |
| 11 | [phase-11-live-lessons.md](phase-11-live-lessons.md) | **Live lessons inside modules** (Upcoming → Join → Recorded), recordings, 60/15-min reminders, web builder + player, student app | 5, 7, 9, 10 |

**Decisions that change the original spec are in `guidelines/DECISIONS.md`.** ⏸️ = greyed out for v1.

## How to run a phase
1. Read the phase file top to bottom.
2. For each task: write the failing test → run it (it fails) → implement → run it (it passes) → commit.
3. Tick each `- [ ]` box as you go.
4. Finish with the phase's "Phase done when" checklist and `/security-review`.

## Shared names (use exactly these across all phases)
- Tables: see `docs/ERD.md` (written in Phase 1). Migrations: `001_core`, `002_content`, `003_exams`, `004_operations`, `005_student`.
- Middleware: `authenticate`, `authorize(...roles)`, `validate` (OpenAPI), `ownsCourse`, `requireActiveEnrollment`.
- Helpers: `APIError(status, message, code)`, `normalizeMobile(str)`, `maskMobile(str)`, `withTransaction(fn)`, `paginate(query)`.
- Providers: `otpSender.send(mobile, code)`, `whatsApp.send(mobile, text)`, `meet.createLink({title, start, durationMin})`, `storage.save(file, kind)` / `storage.signedUrl(key)`.
- Notifications: `notify(userId, { title, message, link })`.
- Audit: `audit(adminId, action, entityType, entityId, before, after, ip)`.
