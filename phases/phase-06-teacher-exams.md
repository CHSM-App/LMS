# Phase 6: Question Bank, Exams, Results Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A question bank per module, with manual entry and Excel import.
- An exam builder that supports every option in spec §5.
- The scoring and results engine that Phase 9 will run student attempts against.

**Architecture:**
- Migration `003_exams.sql`.
- Pure functions for selection and scoring live in `api/src/domain/exam/` with no DB access, so they are fully unit-tested.
- The services orchestrate those functions with the repositories.
- The teacher UI is in `web/src/features/teacher/{question-bank,exams,results}`.

**Tech Stack:** exceljs, a seeded random number generator (`seedrandom`) for reproducible tests.

**Spec:** spec §4 Teacher (Question bank, Create exam, Results), §5 Exam system (all of it).

## Global Constraints
- Each module has its own question bank (Module 1 → Bank 1, and so on).
- **Questions already used in a test are archived, never hard-deleted.**
- Question types: **MCQ, True/False, Fill in the blanks, Multiple correct answers**.
- Question fields: question*, type*, options, correct answer(s)*, module*, subject*, difficulty, marks, negative marks, explanation.
- Excel import: a downloadable template and a per-row error report.
- Exam setup:
  - Scope: single module / multiple modules / full course.
  - Mode: **Practice** (no timer, answers shown instantly, unlimited attempts, not counted) or **Mock** (timer with auto-submit, passing %, attempt limit, result after submit).
  - Selection: manual, or random (questions per module, easy/medium/hard mix).
  - Category and weightage: Unit Test 1, Unit Test 2, Final Exam, Practice (e.g. 20% / 20% / 60%).
  - Other options: total marks, negative marking, time limit, passing %, shuffle questions and options, attempt limit, start and end date.
- Random tests: each student gets their own questions, fixed once the attempt starts. **Saving the exam is blocked if a module has too few questions.**
- Final result: the weighted total of graded exams, with per-exam marks, pass/fail and a module-wise breakdown. **The Final Exam unlocks after the Unit Tests.**

## Review Focus
1. **Weightages that don't add up to 100** across a course's graded categories → saving is blocked with the message "Weightages must total 100% (now 90%)". Task 4.
2. **A random mix asking for 5 hard questions when the module has 3** → saving is blocked, naming the module and the difficulty. Task 4.
3. **Editing a question that is already used in an exam** → a new version is created and the old one is archived, so past attempts keep their original text. Task 1.
4. **Fill-in-the-blank answers with different case, spaces or Devanagari digits** ("Mumbai " vs "mumbai") are marked correct. Task 3 scoring tests.
5. **Negative marking must not push an exam total below 0.** Task 3.

## Data (003_exams.sql)
- `questions(question_id, module_id FK, subject_id FK, course_id FK, type VARCHAR(12) CHECK IN ('mcq','true_false','fill_blank','multi_correct'), text NVARCHAR(2000), difficulty VARCHAR(6) CHECK IN ('easy','medium','hard') DEFAULT 'medium', marks DECIMAL(5,2) DEFAULT 1, negative_marks DECIMAL(5,2) DEFAULT 0, explanation NVARCHAR(2000), accepted_answers_json NVARCHAR(1000) NULL /*fill_blank*/, is_archived BIT DEFAULT 0, replaced_by INT NULL, created_at)` with an index on `(module_id, is_archived, difficulty)`.
- `question_options(option_id, question_id FK, text NVARCHAR(500), is_correct BIT, sort_order)`
- `exams(exam_id, public_id, course_id FK, title NVARCHAR(200), scope VARCHAR(8) CHECK IN ('module','modules','course'), mode VARCHAR(8) CHECK IN ('practice','mock'), selection VARCHAR(6) CHECK IN ('manual','random'), category VARCHAR(12) CHECK IN ('unit_test_1','unit_test_2','final','practice'), weightage DECIMAL(5,2), total_marks DECIMAL(6,2), negative_marking BIT, time_limit_min INT NULL, passing_pct DECIMAL(5,2) NULL, shuffle_questions BIT, shuffle_options BIT, attempt_limit INT NULL, starts_at DATETIME2 NULL, ends_at DATETIME2 NULL, status VARCHAR(10) CHECK IN ('draft','published'), created_at)`
- `exam_modules(exam_id, module_id, easy_count INT, medium_count INT, hard_count INT, PK(exam_id, module_id))`
- `exam_questions(exam_id, question_id, sort_order, PK(exam_id, question_id))` for manual selection.
- `exam_batches(exam_id, batch_id, PK(exam_id, batch_id))`: **no rows = all batches**. Batch rules are in DECISIONS.md.
- `exam_attempts`, `exam_attempt_questions` and `attempt_answers` are also created here so the scoring tests can use them. Their columns are listed in Phase 9.

## Endpoints (teacher, owner only)
| Method | Path | Notes |
|---|---|---|
| GET/POST | /teacher/modules/:moduleId/questions | filter: type, difficulty, archived |
| PUT/DELETE | /teacher/questions/:id | used → new version / archive |
| GET | /teacher/questions/import-template | xlsx download |
| POST | /teacher/modules/:moduleId/questions/import | xlsx → `{imported, errors:[{row, field, message}]}` + error file key |
| GET/POST | /teacher/courses/:courseId/exams | |
| GET/PUT/DELETE | /teacher/exams/:examId | delete only draft with no attempts |
| POST | /teacher/exams/:examId/validate | → `{ok, problems:[...]}` |
| POST | /teacher/exams/:examId/publish | runs validate |
| GET | /teacher/exams/:examId/results | per-student marks, rank, date |
| GET | /teacher/courses/:courseId/final-results | weighted totals per student |

## File Structure
```
api/migrations/003_exams.sql
api/src/domain/exam/{validateQuestion,selectQuestions,scoreAnswer,scoreAttempt,finalResult,rank}.js
api/src/services/{question,questionImport,exam,result}.service.js
api/src/repositories/{question,exam,result}.repo.js
api/src/controllers/teacher/{question,exam,result}.controller.js
api/tests/unit/exam/*.test.js
api/tests/integration/teacher/{questions,questionImport,exams,results}.test.js
web/src/features/teacher/{question-bank,exams,results}/*
```

---

### Task 1: Questions (manual) + archive/versioning

**Interfaces:** Produces `validateQuestion(q) -> string[]` (errors) and `questionService.create/update/remove`.

- [ ] **Step 1:** Write the failing tests. Unit tests for `validateQuestion`:
  - An MCQ needs ≥2 options and exactly 1 correct.
  - Multi-correct needs ≥2 options and ≥1 correct.
  - True/False has exactly 2 options, "True" and "False".
  - Fill-blank needs ≥1 accepted answer.
  - `negative_marks <= marks`.

  Integration tests:
  - Create → 201.
  - Updating an unused question edits it in place.
  - Updating a question used in an exam creates a new question; the old one gets `is_archived=1` and `replaced_by` = the new id.
  - Deleting a used question archives it (the row still exists).
  - Deleting an unused question removes it.
  - Another teacher's module → 404.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(exams): question bank with archive on use`.

### Task 2: Excel import

**Interfaces:** Produces `questionImportService.template() -> Buffer` and `.import(moduleId, buffer) -> {imported, errors}`.
- Template columns: `type | question | option_a | option_b | option_c | option_d | option_e | correct (A / A,C / True / answer1;answer2) | difficulty | marks | negative_marks | explanation`.

- [ ] **Step 1:** Write the failing tests:
  - The template has the exact header row plus 4 example rows, one per type.
  - A file with 3 valid rows and 2 invalid rows imports 3 and returns `errors=[{row:4, field:'correct', message:'MCQ needs exactly one correct option'}, ...]`, plus a downloadable error xlsx.
  - 2,001 rows → 400 "Maximum 2000 rows per import".
  - A cell `=CMD()` is stored as literal text, never evaluated.
  - Marathi text survives the round trip.
  - The whole import runs in one transaction, but invalid rows are skipped rather than aborting the import.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(exams): excel question import with error report`.

### Task 3: Scoring (pure functions)

**Interfaces:**
- `scoreAnswer(question, answer) -> { correct:boolean, marks:number }`
- `scoreAttempt(questions, answers, {negativeMarking}) -> { score, max, perModule:{[moduleId]:{score,max}} }`

- [ ] **Step 1:** Write the failing unit tests:
  - MCQ right → +marks. Wrong → −negative_marks when negative marking is on, 0 when it's off. Unanswered → 0.
  - Multi-correct: only an exact set match scores (no partial marks in v1). Record this as an assumption in Open Questions.
  - Fill-blank: matching normalizes with NFC, trim, collapsed spaces, lower case, and Devanagari digits → ASCII. `" Mumbai"` = `"mumbai"`. `"१०"` = `"10"`.
  - The total is never below 0.
  - The per-module breakdown sums to the total.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(exams): scoring engine`.

### Task 4: Exam builder + validation + selection

**Interfaces:**
- `selectQuestions(pool, examConfig, rng) -> questionId[]` (random mode)
- `examService.validate(examId) -> { ok, problems:string[] }`
- `examService.publish(examId)`

- [ ] **Step 1:** Write the failing tests:
  - Unit test for `selectQuestions`, using a seeded rng:
    - It returns exactly the requested easy/medium/hard counts per module.
    - It never picks archived questions.
    - Two different seeds give different sets.
  - Validate:
    - A module bank smaller than its requested mix → problem "Module 'Algebra' has 3 hard questions, exam needs 5".
    - Mock mode without a time limit or passing % → problem.
    - The sum of graded category weightages for the course ≠ 100 when publishing a `final` exam → problem "Weightages must total 100% (now 90%)".
    - `ends_at <= starts_at` → problem.
    - The total marks don't match the selected questions (manual mode) → problem.
  - Publishing with problems → 422 with the list. Publishing a valid exam → `published`.
  - Practice exams: weightage is forced to 0 and the attempt limit to null. The UI shows "Practice exams don't count toward the final result".
  - Batch targeting: `batchIds:[]` → all batches. `batchIds` containing another course's batch → 400. A closed batch → a warning, but it's allowed.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(exams): exam builder, validation and random selection`.

### Task 5: Results + final weighted result

**Interfaces:**
- `finalResult(courseId, studentId) -> { exams:[{examId, category, score, max, pct, passed}], weightedPct, passed, perModule }`
- `rank(rows) -> rows with rank` (dense rank by score DESC, then earliest submit).
- `isFinalUnlocked(courseId, studentId) -> boolean`: true once the student has a submitted, graded attempt for every Unit Test exam in the course.

- [ ] **Step 1:** Write the failing tests:
  - Fixtures: UT1 80%, UT2 60%, Final 70% with weights 20/20/60 → weighted 70.0%.
  - Practice attempts are ignored.
  - Only the best attempt per exam counts. Record this as an assumption.
  - Ties in rank go to the earlier submission.
  - `isFinalUnlocked` is false until both Unit Tests are submitted.
  - The teacher results endpoint lists every student's marks, rank and date, and supports `?batch=` (ranks are recalculated within the batch).
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(exams): results and weighted final`.

### Task 6: Teacher web screens

- [ ] **Step 1:** Write failing Vitest tests:
  - The question form changes its fields by type.
  - The import shows the per-row error table and a "Download error report" link.
  - The exam builder shows the validation problems inline and disables Publish.
- [ ] **Step 2:** Run and see it fail.
- [ ] **Step 3:** Build:
  - Question bank: module picker, list with filters, add/edit modal, archive badge, Import/Template buttons.
  - Exam builder: a stepper with Scope → Mode → Questions (manual picker, or per-module easy/medium/hard counts showing the available numbers) → Category & weightage → **Batches (all / selected)** → Options → Review.
  - Results: per exam, plus the course's final results.
- [ ] **Step 4:** Run and see it pass. **Step 5:** Commit `feat(web): question bank, exam builder, results`.

## Open questions / assumptions
- Multi-correct questions score all-or-nothing (no partial marks).
- The best attempt counts toward the final result.
- Ranks are per exam, among students of that course.

## Phase done when
- [ ] Tests pass. Manual run: import 20 questions via Excel (including bad rows), build UT1/UT2/Final with random selection, publish them, and see validation block a bad mix.
- [ ] Review Focus is covered and `/security-review` is clean.
