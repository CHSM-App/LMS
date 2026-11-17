# LMS Project Rules

A learning management system with three roles (Super Admin, Teacher, Student). Login uses mobile + OTP only, and there are no payments.
- `api/`: Express + SQL Server
- `web/`: React + Vite (JavaScript), built as static files for Plesk
- `mobile/`: Flutter

## Always
- Read `guidelines/README.md` first and follow every file it lists. `guidelines/lms-full-build-prompt.md` is the spec. **`guidelines/DECISIONS.md` wins over the spec** where the two differ.
- Items marked ⏸️ in DECISIONS.md are greyed out. Keep their columns and hooks, but don't build UI or logic for them.
- Work phase by phase from `phases/` (start with `phases/README.md`). Tick the checkboxes as steps finish.
- Use test-driven development: write a failing test, make it pass, then commit.
- Every security rule in `guidelines/SECURITY.md` applies to all code.
- Put files where `guidelines/FOLDER_STRUCTURE.md` says.
- `docs/openapi.yaml` is the API contract. Update it before changing an endpoint.

- **Colours come only from `design-tokens/tokens.json`** (palette in `guidelines/BRAND-THEME.md`). Never hard-code a colour. Light theme only.

## Conventions
- API base path: `/api/v1`. Response shape: `{ success, data }` or `{ success:false, error }`, plus `pagination` for lists.
- Roles: `admin`, `teacher`, `student`. Shared statuses: `pending`, `approved`, `rejected`, `blocked`. Course status in v1: `draft`, `published` (`pending` is greyed out).
- DB: NVARCHAR for people-entered text, UTC `DATETIME2(3)` with `SYSUTCDATETIME()`, named constraints, an index on every FK, parameterized queries only.
- Languages: English (`en`), Marathi (`mr`), Hindi (`hi`). UI text is never hard-coded.
- Mobile numbers are stored as `+91XXXXXXXXXX`.

## Commands
- API: `cd api && npm test` / `npm run dev` / `npm run migrate` / `npm run seed`
- Web: `cd web && npm test` / `npm run dev` / `npm run build`
- Mobile: `cd mobile && flutter analyze && flutter test`
