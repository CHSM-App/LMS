# Guidelines

Project-wide reference. Every phase and every piece of code must follow these files.

| File | Use it for |
|---|---|
| [lms-full-build-prompt.md](lms-full-build-prompt.md) | **The product spec.** Workflows, page fields, exam rules, security rules and phases. It wins over every other file. |
| [LMS.pdf](LMS.pdf) | Original spec (scanned). Its contents are still to be pasted in; any differences get added to the affected phase. |
| [DECISIONS.md](DECISIONS.md) | **Owner decisions from the plan review.** They win over the spec where the two differ (scope, integrations, batches, greyed-out items). |
| [DESIGN-BRIEF.md](DESIGN-BRIEF.md) | The design brief for this LMS. Read it with frontend.md. |
| [SECURITY.md](SECURITY.md) | Security rules for every phase |
| [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) | Where every file goes |
| [express.md](express.md) | API patterns: routes, middleware, errors, response shape |
| [mssql.md](mssql.md) | SQL Server: types, constraints, indexes, transactions, migrations |
| [frontend.md](frontend.md) | Visual design approach (web + mobile) |
| [Flutter_ARCHITECTURE.md](Flutter_ARCHITECTURE.md) | Flutter app architecture. Apply the §14 fixes and §15 upgrades. |

The documents written during Phase 1 are saved in `docs/` and become part of these guidelines:
`docs/openapi.yaml`, `docs/ERD.md`, `docs/ROLES.md`, `docs/DESIGN.md`, `docs/BACKEND_NEEDS.md`.
