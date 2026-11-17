# Phase 8: Public Site + Live Demo Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the website anyone can open without logging in:
- All published courses, with search and filter
- Course details with 2 demo videos
- The Live Demo request form, verified by OTP and sent to the course's teacher
- Teacher public profiles

**Architecture:** `public.routes.js` uses no auth and is rate limited. Public serializers return only public fields. The web `PublicLayout` is the site's front door.

**Tech Stack:** Same as before. Pages have SEO-friendly titles and meta tags (`react-helmet-async`).

**Spec:** spec §3.3 steps 1–3 and 6, §4 Student (public): Home, Course details, Live demo request form; §6 (demo videos without login).

## Global Constraints
- Students see every teacher's courses with **no login needed**.
- **Home fields:** thumbnail, title, teacher, language, search, filter.
- **Course details fields:** title, full description, modules overview, teacher info, **exactly 2 demo videos**, **Live Demo** and **Enroll Now** buttons.
- **Live demo form fields:** name*, mobile*, OTP*, education*, class/standard, preferred time, message.
- Demo videos can be watched without login and after login.
- Only `published` courses from teachers who are **not blocked** appear.
- Teacher contact details (mobile, email) are never shown publicly.
- **Consent (DECISIONS.md):** the demo form requires "I agree to the Terms and Privacy Policy" and has a WhatsApp opt-in checkbox, which is needed to receive the Meet link on WhatsApp. The helper text says "Without WhatsApp consent, the teacher will call you instead."
- **Footer** on every public page: Terms, Privacy, Contact support, Become a Teacher, plus the language switcher.
- Demo videos play in `VideoFrame`, whether they're uploads or YouTube/Vimeo/Bunny links.

## Review Focus
1. **A course whose teacher gets blocked** disappears from the list and its details page returns 404. Task 1.
2. **Search with Marathi text and with mixed case** ("Maths", "maths", "गणित") finds the course. Task 1.
3. **The same mobile sends 5 demo requests for one course in an hour** → the 2nd one while the first is still pending returns 409 "You already have a pending demo request for this course". Task 2.
4. **Pressing Back in the middle of the OTP step** keeps the entered form data. Task 3 web test.
5. **Paid content is never exposed:** the public course details include the module and content *titles* only, never file keys, except for free-preview items. Task 1.

## Endpoints (public)
| Method | Path | Notes |
|---|---|---|
| GET | /public/courses?q=&language=&subject=&teacher=&page= | cards: `{slug, title, thumbnailUrl, teacher:{name, slug}, language, subject, feeDisplay}` |
| GET | /public/courses/:slug | details + `demoVideos:[url,url]` + `curriculum:[{subject, modules:[{name, contents:[{title, type, freePreviewUrl?}]}]}]` + `teacher:{name, photo, bio, experience, slug}` |
| GET | /public/filters | distinct languages and subjects (for filter dropdowns) |
| GET | /public/teachers/:slug | public profile + published courses |
| POST | /public/demo-requests | `{courseSlug, name, mobile, otp, education, classStandard?, preferredTime?, message?, acceptTerms:true, whatsappOptIn}` |

## File Structure
```
api/src/routes/public.routes.js
api/src/services/publicCatalog.service.js, demoRequest.service.js (extend: create)
api/src/serializers/publicCourse.serializer.js
api/tests/integration/public/{catalog,courseDetails,demoRequestCreate}.test.js
web/src/app/layouts/PublicLayout.jsx
web/src/features/public/{home,course-details,live-demo,teacher-profile}/*
```

---

### Task 1: Catalog + course details

**Interfaces:**
- `publicCatalogService.list(filters) -> {rows, total}`
- `publicCatalogService.bySlug(slug) -> details | null`
- `publicCourseSerializer(course)`: an allow-list of fields.

- [ ] **Step 1:** Write the failing tests:
  - Only published courses from non-blocked teachers are listed. Draft courses and courses from blocked teachers are excluded.
  - Search matches the title, subject and teacher name, ignoring case, including Devanagari.
  - The language and subject filters work. Pagination returns a total.
  - Details include exactly 2 demo video URLs that play without a token.
  - A content item that isn't free preview has no URL. A free-preview item has a signed URL.
  - The response JSON contains no `mobile`, `email`, `file_key` or `teacher_id`, checked by a recursive key scan.
  - An unknown slug → 404.
- [ ] **Step 2:** Run and see it fail. **Step 3:** Implement. Search uses `LIKE @q + '%'` on the title plus an `NVARCHAR` contains match. Add full-text search later if needed. **Step 4:** Run and see it pass.
- [ ] **Step 5:** Commit `feat(public): course catalog and details`.

### Task 2: Demo request create (OTP)

**Interfaces:** Consumes `otpService.verify(mobile, 'demo_request', otp)` and `notify(teacherId, …)`. Produces `demoRequestService.create(fields) -> {id}`.

- [ ] **Step 1:** Write the failing tests:
  - Valid → 201, a `pending` row for the right teacher, and the teacher gets the notification "New live demo request for {course}".
  - A wrong OTP → 400 and no row.
  - `acceptTerms` missing → 400. `whatsappOptIn=true` → a `legal_consents` row of type `whatsapp`.
  - A missing `education` → 400.
  - A second pending request for the same mobile and course → 409.
  - A course that isn't published → 404.
- [ ] **Steps 2–4:** Run and see it fail → implement → run and see it pass. **Step 5:** Commit `feat(public): live demo request`.

### Task 3: Public web pages

- [ ] **Step 1:** Write failing Vitest tests:
  - Home renders course cards from the API, and the search input debounces before querying.
  - Course details shows 2 video players, plus Live Demo and Enroll Now buttons.
  - The Live Demo form validates the required fields, then shows the OTP step. Going back keeps the values.
  - On success it shows "Request sent. {teacher} will message you on WhatsApp with the date and time."
- [ ] **Step 2:** Run and see it fail.
- [ ] **Step 3:** Build the pages, following DESIGN.md wireframes:
  - `PublicLayout`: header with Courses, Become a Teacher and Login, plus a language switcher.
  - `/`: home course list with search and filters. The empty state is "No courses match. Clear filters".
  - `/courses/:slug`: details, curriculum accordion and teacher card.
  - `/courses/:slug/live-demo`: the form, as a modal on desktop and a page on mobile.
  - `/teachers/:slug`.
  - Enroll Now goes to `/enroll/:slug`, built in Phase 9.
  - Set the page `<title>` and meta description for each course.
- [ ] **Step 4:** Run and see it pass. Manually check at 360 px. **Step 5:** Commit `feat(web): public site`.

## Phase done when
- [ ] Tests pass. Manual run: browse logged out, search in Marathi, watch both demo videos, send a demo request → it appears on the teacher's Requests page (Phase 7) → schedule and send on WhatsApp.
- [ ] Review Focus is covered and `/security-review` is clean.
