# Review: frontend.md + Phases 1–10

Reviewed against `guidelines/lms-full-build-prompt.md`.
**Status: APPLIED on 2026-11-17.** Every decision below is written into `guidelines/DECISIONS.md`, `guidelines/DESIGN-BRIEF.md`, `guidelines/SECURITY.md`, `CLAUDE.md` and phases 1–10. Section G lists exactly what changed. This file is kept as the record of the review.

Legend: ➕ add · ✂️ remove · 🔽 simplify · ⏸️ grey out (defer to later; keep the hooks, don't build it now) · ❓ needs your decision

---

## A. guidelines/frontend.md

frontend.md is a general design guide, written mostly for **marketing/landing pages**: "hero", headline treatments, page-load motion. Our LMS is about 90% **app screens**: dashboards, tables, forms, an exam screen and a video player. Here are the gaps for this project.

| # | Type | Recommendation | Why |
|---|---|---|---|
| A1 | ➕ | Add a **project design brief** section: brand name, logo, audience, tone and any colours you already use. | The guide says "identify the subject and confirm with the client". We don't have that yet (see questions Q5–Q7). |
| A2 | ➕ | Add an **app UI** section covering dashboards, data tables, forms, validation messages, empty/loading/error states and status badges. | Most screens are app screens, and the guide only covers landing pages. |
| A3 | ➕ | Add **mobile-first + low-end Android** rules: 360 px first, tap targets ≥ 44 px, light pages for slow 3G/4G, small image sizes. | Most students in India will use budget phones on mobile data. |
| A4 | ➕ | Add **Devanagari typography** rules: a font that supports Marathi/Hindi, about 10% extra line-height, no letter-spacing on Devanagari, no italics for Devanagari. | Bad Devanagari rendering is the most visible quality problem in Indian apps. |
| A5 | ➕ | Add a **web ↔ Flutter consistency** rule: one token set (colours, type, spacing, radius) used by both apps. | So the website and the app look like the same product. |
| A6 | ➕ | Add **writing rules for 3 languages**: short labels (Marathi/Hindi text runs 20–40% longer), no text inside images, and the same action name across the whole flow. | Translations break layouts if this isn't planned. |
| A7 | ➕ | Add **media rules**: course thumbnails 16:9, minimum 1280×720, a demo video player style, and a PDF viewer style. | Teachers upload their own media, so the layout must survive their files. |
| A8 | 🔽 | Mark the **"hero" and page-load motion** guidance as applying to the **public home + course details pages only**. | Dashboards should be calm and fast, without animations. |
| A9 | ✂️ | Remove the note about Anthropic's accent colour (#D97757). | It isn't relevant to your product. |

**Suggestion:** keep frontend.md unchanged as the general guide, and add a short `guidelines/DESIGN-BRIEF.md` with A1–A8 specific to this LMS. Phase 2 would then read both.

---

## B. Missing features (things the spec doesn't mention but you will need)

| # | Type | Feature | Why it matters |
|---|---|---|---|
| B1 | ➕ | **Privacy policy + terms pages**, and a consent checkbox at registration | Required by **India's DPDP Act 2023** and by **Google Play / App Store**. |
| B2 | ➕ | **Delete my account** (in the app plus a web link) | **Google Play requires this** for any app with accounts. Without it the app gets rejected. |
| B3 | ➕ | **WhatsApp opt-in consent** on the demo/registration forms | Meta requires opt-in before you message users. |
| B4 | ➕ | **What happens when a teacher's subscription expires?** | The spec says the admin manages teacher subscriptions but never says what expiry does. See question Q8. |
| B5 | ➕ | **Change mobile number** (OTP on both the old and new numbers, or done by the admin) | Mobile is the only login, so a lost or changed SIM locks the user out forever. |
| B6 | ➕ | **Contact/support link** on login error screens ("Account blocked. Contact support") | Blocked or rejected users need somewhere to go. |
| B7 | ➕ | **Teacher subscription expiry reminders** (7 days before) to the teacher and admin | Cheap to add, and it stops surprise lock-outs. |
| B8 | ➕ | **Video upload progress + resume** for teachers | Large uploads on Indian mobile data often fail halfway. (Or avoid uploads entirely: see Q3.) |

---

## C. Simplify / remove / grey out

| # | Type | Item | Current plan | Recommendation |
|---|---|---|---|---|
| C1 | ❓🔽 | **Flutter full parity** (Phase 10) | Every admin, teacher and student screen in the app | **Student app + light teacher app** (requests, students, live classes, attendance, doubts). **Course builder, question bank, exam builder and admin stay on the web only.** Saves about 40% of the Flutter work. These are desk tasks anyway. |
| C2 | ❓🔽 | **WhatsApp sending** | Meta WhatsApp Business API (needs approval, templates, per-message cost) | **"Send on WhatsApp" opens the teacher's own WhatsApp** with the message already typed (`wa.me` link). Free, no approval, works on day one. The official API can come later. |
| C3 | ❓🔽 | **Google Meet link generation** | Google Calendar API (needs Workspace + OAuth) | **The teacher pastes their Meet link.** One field. Add the API later if teachers ask for it. |
| C4 | ❓🔽 | **Video hosting** | Upload to our own server (up to 500 MB per file) | **The teacher pastes a YouTube (unlisted) / Vimeo / Bunny Stream link.** Plesk bandwidth and storage would get expensive and slow. Keep uploads for PDFs and thumbnails only. |
| C5 | 🔽 | **Course status "Pending"** | Draft → Pending → Published | The admin doesn't review courses (spec §3.2), so "Pending" has no reviewer. **Use Draft → Published only.** Keep the column so Pending can return later. |
| C6 | ⏸️ | **Dark mode** | Light + dark themes | Build **light only** for v1, but keep the tokens so dark mode can be added later. |
| C7 | ⏸️ | **Marathi + Hindi translations** | Full UI in 3 languages from Phase 1 | **Keep the i18n setup (no hard-coded text), ship English first**, and add the translations before launch. Course *content* can still be in any language. |
| C8 | 🔽 | **Mobile offline answer queue** (sqflite outbox for exams) | Full offline storage + replay | **In-memory retry + server autosave** already covers short network drops (the spec's requirement). Grey out the sqflite outbox. |
| C9 | 🔽 | **Refresh-token "family" theft detection** | Full rotation + family revoke | Keep rotation, but simplify the family logic to "a reused token logs out all sessions". Same safety, less code. |
| C10 | 🔽 | **Course "subject" field vs "Subject" entity** | Both are called "subject" | Rename the course-level field to **"Category"** (e.g. Maths, Science, MPSC) to avoid confusion with the Subject → Module tree. |
| C11 | 🔽 | **Class programs "batch"** | Free text | Keep free text. Don't build a batch system unless you need one (see Q9). |
| C12 | ⏸️ | **Playwright end-to-end suite** (Phase 10) | 6 full flows | Keep 3 critical flows for v1: login/approve, student enroll→exam→result, deep-link refresh. |
| C13 | 🔽 | **Teacher subscription "plan"** | Free text | Keep free text, or use a fixed list (Monthly / Quarterly / Yearly). See Q10. |

**Combined effect of C1–C8:** roughly **30–35% less build effort**, no paid third-party approvals needed to launch, and the features in the spec are unchanged.

---

## D. Phase-plan fixes (small, no decision needed)

- **D1. Phase 1:** add `privacy`, `terms` and `account_deletion` to the OpenAPI contract and ERD (`users.deleted_at`, with personal data anonymised on delete).
- **D2. Phase 3:** add the consent checkbox + `consented_at` to registration (B1, B3).
- **D3. Phase 4:** the admin dashboard gets an "expiring in 7 days" list (B7).
- **D4. Phase 6:** the spec lists **Practice** as a weightage category but also says Practice is "not counted". The plan forces its weight to 0%; keep that, but state it in the UI.
- **D5. Phase 8:** the public pages need a footer with Privacy, Terms and Contact (B1, B6).
- **D6. Phase 10:** add a Play Store compliance checklist: data safety form, account deletion URL, privacy URL.
- **D7. All phases:** apply the decisions from section C so the plans and tests match.

---

## Decisions so far (2026-11-17)
| Item | Decision |
|---|---|
| Q1 / C1 Mobile app | **Full student app + light teacher app** (requests, students, live classes, attendance, doubts). Builders and admin are web only. |
| Q2 / C2–C3 WhatsApp + Meet | **Official WhatsApp Business API + Google Meet links created automatically.** Keep the manual paste/`wa.me` fallback while the accounts are being approved. |
| Q3 / C4 Videos | **Both:** the teacher chooses a link (YouTube/Vimeo/Bunny) or an upload for each video. Uploads need progress + resume (B8). |
| Q4 Grey out for v1 | **Course "Pending" status** (Draft → Published only) and **mobile offline answer queue**. |
| Q4 Keep in v1 | **Dark mode** and **Marathi + Hindi translations**. |
| Q8 / B4 Teacher subscription expiry | **Limited mode:** the teacher can log in and current students keep learning, but the teacher can't publish new courses or approve new students until renewed. |
| Added features | **B1–B3** (privacy, terms, consent, delete account), **B5** (change mobile number), **B6–B7** (support link, expiry reminders), **A1–A8** (new `guidelines/DESIGN-BRIEF.md`; frontend.md stays as-is). |
| Q9 Batches | **Real batches.** Proposed rules are in section F and waiting for confirmation. |
| Q10 Teacher plans | **Fixed list + custom:** Monthly / Quarterly / Half-yearly / Yearly fill in the end date automatically, and Custom lets the admin pick the dates. |

## F. Proposed batch rules (please confirm)
1. A teacher creates **batches per course**: name*, start date*, end date, timing (e.g. "Mon–Fri 7–8 am"), max students (optional), status.
2. When the teacher **approves an enrollment, they assign a batch**. Each student is in **one batch per course**, and the teacher can move them later.
3. **Course content (videos, PDFs) is the same for all batches.**
4. **Live classes, class programs and attendance target one batch** (or "All batches").
5. **Exams can target all batches or selected batches.** Results and ranks can be filtered by batch.
6. The student list and attendance sheet can be filtered by batch.
7. New table `batches` + `enrollments.batch_id`, `live_classes.batch_id`, `class_programs.batch_id`, `exam_batches`. These touch Phases 6, 7 and 9.

## E. Questions for you

1. **Q1:** Mobile app scope (C1)?
2. **Q2:** WhatsApp: `wa.me` link from the teacher's phone, or the official API (C2)?
3. **Q3:** Videos: links (YouTube/Vimeo/Bunny) or upload to our server (C4)?
4. **Q4:** Which items to grey out for v1 (C5–C8)?
5. **Q5:** What is the **brand / product name**? Do you have a logo or colours?
6. **Q6:** **Who are the students?** School (which classes?), college, competitive exams (MPSC/UPSC/NEET/JEE), skills or hobby classes? This drives the whole visual design.
7. **Q7:** Any **app or website you like the look of** (or dislike)?
8. **Q8:** When a **teacher's subscription expires**, what happens?
   - (a) Nothing; it's just for records.
   - (b) The teacher can't log in, and students go read-only like a block.
   - (c) The teacher can log in but can't publish or approve new students.
9. **Q9:** Do teachers run **batches** (e.g. "Morning batch", "Batch 2026") that students belong to, or is "batch" just a label?
10. **Q10:** Teacher subscription plans: free text, or a fixed list (Monthly / Quarterly / Yearly / custom)?
11. **Q11:** Is **LMS.pdf** different from the markdown spec in any way? Please paste anything extra from it.

---

## G. What was changed (final results)

| File | Changes |
|---|---|
| `guidelines/DECISIONS.md` | **New.** Every owner decision; it wins over the spec. |
| `guidelines/DESIGN-BRIEF.md` | **New.** The LMS-specific design brief (A1–A8). frontend.md is unchanged. |
| `guidelines/SECURITY.md` | + consent records, account deletion (anonymise), change mobile |
| `guidelines/README.md`, `FOLDER_STRUCTURE.md`, `CLAUDE.md` | Link to DECISIONS + DESIGN-BRIEF. No admin screens in the app. Course status is Draft/Published. |
| Phase 1 | ERD + `legal_consents`, `mobile_change_requests`, `upload_sessions`, `batches` (002), `exam_batches` (003). `users.whatsapp_opt_in`, `users.deleted_at` (mobile unique only while not deleted). `plan_type` list. New OTP purposes. BACKEND_NEEDS + legal text + support contact. |
| Phase 2 | Uses DESIGN-BRIEF. + `Banner`, `UploadProgress`, `VideoFrame`. Expired/Paused badges. Placeholder brand. |
| Phase 3 | + Task 7: consent, change mobile (self + admin), delete account, Terms/Privacy pages, support links |
| Phase 4 | Plan list + Custom with automatic end date. **Limited mode** middleware. 7-day expiry reminder job. |
| Phase 5 | Draft → Published (⏸️ Pending). Video **link or chunked resumable upload**. Publishing needs an active subscription. + Task 4b **Batches**. |
| Phase 6 | Exams target all/selected batches. Results filter by batch. Practice "doesn't count" note. |
| Phase 7 | Approve needs a batch (closed/full checks). Move batch. Batch-targeted live classes/programs/attendance. WhatsApp API + `wa.me` fallback + opt-in check. Limited mode blocks approve. + Task 7 **light teacher Flutter app**. |
| Phase 8 | Consent + WhatsApp opt-in on the demo form. Footer (Terms, Privacy, Support). `VideoFrame`. |
| Phase 9 | Batch-aware dashboard/live classes/exams. ⏸️ offline queue. Account settings link. |
| Phase 10 | Flutter = student app (+ light teacher re-check), no admin in the app. Play Store / WhatsApp / DLT / translation / dark-mode release checks. Bigger notification event matrix. |

## H. Still open (assumed defaults are in use; change any time)
1. **Brand name / logo / colours.** Placeholder "LMS"; tokens make a rebrand a one-file change.
2. **Student audience.** Assumed: school + competitive exam coaching in Maharashtra.
3. **Batch rules** (DECISIONS.md). Assumed as proposed in section F.
4. **Design references** you like or dislike.
5. **LMS.pdf** extra content.

## I. Added on 2026-11-17: student videos online + offline (no sharing)
| File | Changes |
|---|---|
| `guidelines/DECISIONS.md` | New row + the "Offline video download rules" (10 rules) |
| `guidelines/SECURITY.md` | New §6b: licence, encryption at rest, no decrypted copy on disk, screenshot block, audit |
| Phase 1 | ERD [005] + `student_devices`, `offline_downloads` |
| Phase 9 | Tables + endpoints (devices, download licence, renew, progress sync) + **Task 6b** (API tests). Web player is stream-only with no download control. |
| Phase 10 | **Task 2b**: Flutter downloads (encrypted store, decrypting local stream, licence guard, Downloads screen, Wi-Fi-only, pause/resume, storage bar, devices) + release checks |
