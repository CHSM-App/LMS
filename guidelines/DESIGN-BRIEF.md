# Design Brief (LMS-specific)

Read this **together with** `frontend.md`. frontend.md is the general approach; this file is the brief for this product.
Phase 2 turns it into `docs/DESIGN.md` (tokens).

## 1. Subject, audience, job
- **Product:** a platform where independent teachers sell access to their courses, run live classes and exams, and track students. There are no payments.
- **Name / logo / colours:** **TBD.** Use a neutral working name, "LMS", and placeholder colours until the owner confirms them.
- **Audience (assumed, confirm):** school and competitive-exam students in Maharashtra (ages 12–25), mostly on budget Android phones. Teachers are coaching-class owners, aged 25–55 and not very tech-savvy, working on a laptop or phone.
- **Primary job of each area:**
  - **Public site:** help a student find a course and request a live demo within 2 minutes.
  - **Student:** "What do I study or attend next?"
  - **Teacher:** "Who is waiting for me?" (requests, doubts, today's classes)
  - **Admin:** "Which teachers need action?"

## 2. Where frontend.md applies
- **Hero, display type and one orchestrated motion moment:** the **public home and course details pages only**.
- **All dashboards, forms, tables, the exam screen and the player:** calm, dense enough, fast, and **no decorative motion**. Motion is only allowed when it answers an action (opening, saving, confirming).

## 3. App UI rules
- Every list has **4 states**: loading (skeleton), empty (says what to do + an action button), error (what went wrong + Retry), and data.
- Forms: the label sits above the field; errors appear under the field in plain words; the required fields are clear; the submit button names its action ("Send request", "Approve student").
- Status badges use the same colours and words on every screen: Pending, Approved, Rejected, Blocked, Draft, Published, Expired, Paused.
- Tables become stacked rows below 640 px. The primary action stays visible.
- The exam screen gets no distractions: a large timer, a question palette, saved/offline status, and a confirm step before submit.

## 4. Mobile-first + budget Android
- Design at **360 px first**, then 768, then 1280.
- Tap targets are at least **44 px**. Primary buttons are reachable with a thumb on mobile.
- Keep the first load light: no large hero images, WebP thumbnails, lazy-load below the fold, and at most 2 web-font files.
- Readable outdoors: AA contrast as a minimum, and body text at 16 px or more.

## 5. Devanagari (Marathi / Hindi)
- Use a family with good Latin + Devanagari support (e.g. Mukta, Hind, Noto Sans Devanagari, Baloo 2). Pick one in Phase 2.
- Devanagari gets **about 10% more line-height**, **no letter-spacing**, **no italics** and **no all-caps** (the last applies to Latin too).
- Labels and buttons must fit text that runs **20–40% longer** than English. Wrap; don't truncate important words.

## 6. Web ↔ app consistency
- One token set (colour, type, spacing, radius, status colours) drives both `web/src/design/tokens.css` and the Flutter `AppTheme`.
- The same names for the same actions in both apps and in all 3 languages.

## 7. Media
- Course thumbnails are **16:9**, minimum 1280×720, and the UI crops safely.
- Demo videos use one consistent player frame. Link videos (YouTube/Vimeo/Bunny) are embedded in the same frame as uploaded ones.
- The PDF viewer has a title, page count, and Download (where allowed).

## 8. Words
- Plain verbs, sentence case, no filler. Errors say what happened and how to fix it, and never apologise.
- Never say "Submit". Name the action instead.
- Write every string as an i18n key from the start.
