# Roles and Permissions

Deny by default. Every route declares its roles. "Own" means the row belongs to the caller: a teacher's own courses/students, or a student's own data.
Admin scope follows spec §3.2: teachers, teacher subscriptions, notifications and audit only. **No courses, content or exams.**

| Area (route prefix) | public | student | teacher | admin |
|---|---|---|---|---|
| `/health`, `/public/*` (catalog, course details, teacher profile, demo request, legal) | ✅ | ✅ | ✅ | ✅ |
| `/auth/*` (OTP, login, refresh, logout, me) | ✅ | ✅ | ✅ | ✅ |
| `/teacher-requests` (Become a Teacher) | ✅ | – | – | – |
| `/account/*` (change mobile, delete account) | – | own | own (delete blocked if they have students) | own |
| `/notifications/*` | – | own | own | own |
| `/admin/teacher-requests/*` | – | – | – | ✅ |
| `/admin/teachers/*` (list, block, activate, detail) | – | – | – | ✅ |
| `/admin/subscriptions/*` | – | – | – | ✅ |
| `/admin/users/:id/change-mobile` | – | – | – | ✅ |
| `/admin/audit-log` | – | – | – | ✅ |
| `/teacher/courses, subjects, modules, contents, batches` | – | – | own | – |
| `/teacher/questions, exams, results` | – | – | own | – |
| `/teacher/demo-requests, enrollments, students, live-classes, attendance, doubts, programs, profile` | – | – | own | – |
| `/uploads/*` | – | doubt attachments | own | – |
| `/files/:key` | demo videos + thumbnails | enrolled content (signed) | own (signed) | – |
| `/student/*` (dashboard, player, exams, results, doubts, progress, devices, downloads) | – | own + active enrollment | – | – |

Extra checks:
- **Blocked user:** 401 on every call (tokens revoked; status re-read from the DB).
- **Teacher subscription expired (limited mode):** 403 `TEACHER_SUBSCRIPTION_EXPIRED` on publishing a course and approving an enrollment only.
- **Blocked teacher → their students:** read-only, completed content only.
- **Student mobile numbers:** never returned to other students. They are visible to the owning teacher and the admin only.
