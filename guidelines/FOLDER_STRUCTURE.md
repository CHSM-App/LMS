# Folder Structure

```
learning management/
├── CLAUDE.md      ← project rules (read first)
├── guidelines/    ← spec + guides used across the whole project
├── phases/        ← one step-by-step plan per phase
├── api/           ← backend: Express + SQL Server
├── web/           ← website: React + Vite (JavaScript)
├── mobile/        ← app: Flutter
└── docs/          ← openapi.yaml, ERD.md, DESIGN.md, BACKEND_NEEDS.md
```

## api/
```
api/
├── src/
│   ├── app.js           creates the Express app: middleware, routes, error handler
│   ├── server.js        app.listen
│   ├── config/          env.js: reads and validates .env
│   ├── db/              pool.js (mssql pool), tx.js (transaction helper)
│   ├── middlewares/     authenticate, authorize, validate, rateLimits, upload, errorHandler
│   ├── routes/          auth, admin, teacher, public, student (mounted under /api/v1)
│   ├── controllers/     read the request → call a service → send the response
│   ├── services/        business rules
│   ├── repositories/    SQL only (parameterized)
│   ├── serializers/     the allowed fields for each role
│   ├── providers/       otp/, whatsapp/, meet/, storage/ (one interface + implementations each)
│   ├── jobs/            node-cron jobs (OTP cleanup, exam auto-submit sweep)
│   └── utils/           APIError, pagination, mobile normalize, mask
├── migrations/          001_core.sql, 002_content.sql, 003_exams.sql, 004_operations.sql, 005_student.sql
├── scripts/             migrate.js, seed.js
├── seeds/
├── tests/               Jest + Supertest (unit/ and integration/)
└── .env.example
```

Request flow: `route → authenticate → authorize → validate → controller → service → repository → SQL`.

## web/
```
web/src/
├── main.jsx
├── app/          router.jsx, layouts (PublicLayout, AdminLayout, TeacherLayout, StudentLayout), RequireRole.jsx
├── api/          client.js (fetch + access token + refresh on 401), queryClient.js
├── features/
│   ├── auth/     login, OTP, become-teacher, student registration
│   ├── admin/    teacher-requests, teachers, subscriptions, notifications, audit-log
│   ├── teacher/  courses, subjects, modules, contents, question-bank, exams, results,
│   │             live-classes, requests, students, attendance, doubts, programs, access, profile
│   ├── public/   home, course-details, live-demo
│   └── student/  dashboard, my-courses, player, notes, exams, results, doubts, progress, profile
├── components/   Button, Input, OtpInput, Select, Table, Modal, Toast, StatusBadge, EmptyState, FileUpload
├── design/       tokens.css, global.css
└── i18n/         en.json, mr.json, hi.json
```
Each feature folder contains `XxxPage.jsx`, `useXxx.js` (TanStack Query hooks) and `xxx.api.js`.

## mobile/ (see guidelines/Flutter_ARCHITECTURE.md)
```
mobile/lib/
├── main.dart
├── core/           network/ (dio, interceptor, token), storage/, env.dart, theme/
├── data/           api/ (Retrofit), local/ (sqflite DAOs), repositories/
├── domain/         models/ (freezed + json), repository/ (abstract), usecase/
├── presentation/   providers/, viewModels/
├── screens/        auth/, public/, student/, teacher/ (light: requests, students, live classes, attendance, doubts). No admin in the app.
└── widgets/
```
Flow: `Screen → ViewModel → UseCase → Repository → ApiService`.

## docs/
- `openapi.yaml`: the API contract that the web, mobile and API code all follow
- `ERD.md`: database diagram (mermaid)
- `DESIGN.md`: design tokens
- `BACKEND_NEEDS.md`: outside services needed
