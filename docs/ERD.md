# Entity Relationship Diagram

Migrations: `001_core`, `002_content`, `003_exams`, `004_operations`, `005_student`. All keys are `INT IDENTITY` unless noted, and all times are UTC `DATETIME2(3)`.

```mermaid
erDiagram
  users ||--o| teacher_profiles : "teacher"
  users ||--o| student_profiles : "student"
  users ||--o{ teacher_requests : "creates on accept"
  users ||--o{ teacher_subscriptions : "teacher"
  users ||--o{ refresh_tokens : has
  users ||--o{ notifications : receives
  users ||--o{ admin_audit_log : "admin acts"
  users ||--o{ legal_consents : gives
  users ||--o{ mobile_change_requests : requests

  users ||--o{ courses : "teacher owns"
  courses ||--o{ subjects : has
  subjects ||--o{ modules : has
  modules ||--o{ contents : has
  courses ||--o{ batches : has
  users ||--o{ upload_sessions : uploads

  modules ||--o{ questions : "question bank"
  questions ||--o{ question_options : has
  courses ||--o{ exams : has
  exams ||--o{ exam_modules : "random mix per module"
  exams ||--o{ exam_questions : "manual pick"
  exams ||--o{ exam_batches : "targets (none = all)"
  exams ||--o{ exam_attempts : has
  exam_attempts ||--o{ exam_attempt_questions : "frozen set"
  exam_attempts ||--o{ attempt_answers : "autosaved"

  courses ||--o{ demo_requests : receives
  users ||--o{ enrollments : "student"
  courses ||--o{ enrollments : has
  batches ||--o{ enrollments : groups
  enrollments ||--|| student_subscriptions : "access period"
  courses ||--o{ live_classes : has
  batches ||--o{ live_classes : "targets (null = all)"
  live_classes ||--o{ attendance : records
  users ||--o{ doubts : asks
  users ||--o{ class_programs : "teacher"

  users ||--o{ content_progress : "student"
  contents ||--o{ content_progress : tracks
  users ||--o{ student_devices : registers
  student_devices ||--o{ offline_downloads : licenses
  contents ||--o{ offline_downloads : downloaded
```

| Migration | Tables |
|---|---|
| 001_core | users, teacher_profiles, student_profiles, teacher_requests, teacher_subscriptions, otp_codes, refresh_tokens, notifications, admin_audit_log, legal_consents, mobile_change_requests |
| 002_content | courses, subjects, modules, contents, batches, upload_sessions |
| 003_exams | questions, question_options, exams, exam_modules, exam_questions, exam_batches, exam_attempts, exam_attempt_questions, attempt_answers |
| 004_operations | demo_requests, enrollments, student_subscriptions, live_classes, attendance, doubts, class_programs |
| 005_student | content_progress, student_devices, offline_downloads |

Key rules:
- `users.mobile` is unique only among non-deleted users (`deleted_at IS NULL`).
- Teacher-owned data is always queried with `teacher_id = @me`.
- Questions used in an exam are archived (`is_archived`, `replaced_by`), never deleted.
- `admin_audit_log` is append-only.
