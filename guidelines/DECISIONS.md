# Project Decisions

Decisions made on 2026-11-17 during the plan review. **These win over `lms-full-build-prompt.md` where the two differ.**
Items marked **(assumed)** are defaults that still need the owner's confirmation.

## Scope
| Topic | Decision |
|---|---|
| Website | Every feature for every role. |
| Mobile app (Flutter) | **Full student app + light teacher app**: requests, students, live classes, attendance, doubts, notifications, profile. **Web only:** course builder, question bank, exam builder, results admin, and the whole Super Admin app. |
| Languages | English, Marathi and Hindi in v1. |
| Themes | **Light only** (dark mode was removed on 2026-11-17 because the palette is fixed). |
| Brand colours | **Fixed palette, see `BRAND-THEME.md`**: Orange #F45803, Ice #EEF4FF, Lime #72CF10, Blue #5C8FF7, White #FFFFFF, Navy #14264C, plus functional Error #C62828. Opacity tints only as tokens. Primary buttons have White bold labels ≥ 19 px. |

## Integrations
| Topic | Decision |
|---|---|
| WhatsApp | **Official WhatsApp Business API** (Meta Cloud API, approved template). **Fallback** until approval: "Send on WhatsApp" opens a `wa.me` link with the message already typed. |
| Google Meet | **Created automatically** through the Google Calendar API (Workspace account, `MEET_PROVIDER=google`). **Fallback:** the teacher pastes a link. For live classes and live lessons the link is **optional when scheduling**: without the Google provider the class is saved with no link (never a made-up one), the teacher adds it later with **"Add Meet link"**, and the class reminder asks the teacher to add it if it is still missing. Teachers see **"Join"** (opens Meet any time); students see Join only in the join window and "The teacher will share the link soon" if it is class time with no link. (Updated 2026-11-18.) |
| OTP | SMS provider (DLT-registered template). |
| Videos (lessons + 1 required and 1 optional demo video) | **Both options:** the teacher picks either a **link** (YouTube unlisted / Vimeo / Bunny Stream) or an **upload** for each video. Uploads are chunked and resumable, with a progress bar. |

## Rules
| Topic | Decision |
|---|---|
| Teacher registration | **Auto-approved** (changed 2026-11-19). "Become a Teacher" creates the teacher account as soon as the OTP is verified; the teacher can log in at once. Admins get a "New teacher registered" notification and can **block** the teacher from Teachers. Admin accept/reject stays only for requests that were pending before this change. |
| Course status | **Draft → Published** only. "Pending" is ⏸️ greyed out (the column value is kept for the future, but nothing in the UI or API uses it in v1). |
| Teacher subscription plans | Fixed list **Monthly / Quarterly / Half-yearly / Yearly** (the end date fills in automatically) + **Custom** (the admin picks the dates). |
| Teacher subscription expired | **Limited mode:** the teacher can log in and current students keep learning, but the teacher **cannot publish courses or approve new enrollments** until renewed. A banner tells the teacher "Your subscription ended on {date}. Contact the admin to renew." |
| Expiry reminders | 7 days before the end: an in-app notification to the teacher and admin, plus WhatsApp to the teacher. |
| Batches | **Real batches** (rules below) **(rules assumed)**. |
| **Student video: online + offline** | **Online:** every video streams on the website and in the app. **Offline:** the student can **download uploaded videos inside the mobile app only**, to watch without internet. **No share option anywhere**: no share button, no "save to gallery", no export, no file link. Rules are below. |
| Mobile offline answer queue | ⏸️ Greyed out. Server autosave + in-memory retry covers network drops. |
| Account deletion | Users can delete their account (app + web). Personal data is anonymised, while exam/attendance records stay with "Deleted user". Required by Google Play. |
| Change mobile number | The user verifies an OTP on the **new** number while logged in. If the old SIM is lost, the **admin** changes it (audit logged). |
| Consent | Registration and demo forms require "I agree to the Terms and Privacy Policy" plus a separate WhatsApp opt-in. Both are stored in `legal_consents` with the policy version. |
| Support | A "Contact support" link on the blocked, rejected and expired screens. |

## Batch rules (assumed; confirm)
1. A teacher creates batches per course: name*, start date*, end date, timing, max students, status (active/closed).
2. When **approving an enrollment**, the teacher picks a batch. A student has **one batch per course**, and the teacher can move them later.
3. Course content is the same for every batch.
4. Live classes, class programs and attendance target **one batch or all batches**.
5. Exams target **all batches or selected batches** (`exam_batches`).
6. Student list, attendance, results and ranks can be filtered by batch.

## Offline video download rules
1. **Where:** the Flutter app only. The website streams online only and shows "Download in the app to watch offline".
2. **What:** only videos with `video_source = 'upload'` (lessons + demo videos of enrolled courses). YouTube/Vimeo/Bunny links are **online only**, because their terms don't allow downloading. The download button is hidden for them.
3. **Who:** students with an active enrollment (approved, access on, within the dates). A blocked teacher's students keep only downloads of **completed** content.
4. **Storage:** files are saved **encrypted** (AES-256-CTR) inside the app's private folder. They don't appear in the gallery or file manager, and can't be opened by other apps or copied to another phone.
5. **Licence:** each download gets a licence for that device that is valid for **7 days offline**. It renews automatically whenever the app is online, and never runs past the subscription end date. When the licence expires, the video locks until the app goes online again.
6. **Automatic removal:** downloads are deleted when the subscription ends, access is paused, the enrollment is removed, the student logs out, or the account is deleted.
7. **Devices:** downloads are allowed on at most **2 devices** per student. The student can remove a device in Profile → Downloads.
8. **No sharing:** no share/export/open-with actions. The player screen blocks screenshots and screen recording (Android `FLAG_SECURE`; on iOS the video is hidden while recording).
9. **Student controls:**
   - Download, pause, resume, cancel and delete
   - "Download on Wi-Fi only" (on by default)
   - Downloads list with each video's size, total storage used, and "Delete all"
   - A warning when phone storage is low
10. **Progress offline:** watch position and "mark complete" are saved on the phone and synced the next time the app is online.

## Live lessons inside modules (confirmed 2026-11-18)
Added 2026-11-18. A module can mix **recorded** lessons (video, PDF, link) and **live** lessons,
so a course can be fully recorded, fully live, or mixed (hybrid).

1. **New content type `live`:** besides video, PDF and link, the teacher can add a live lesson
   to any module. It has a title*, date*, time*, duration, and a Meet link* (created
   automatically, or pasted by the teacher as a fallback, same as live classes).
2. **Who:** a live lesson targets **one batch or all batches**, same as live classes.
3. **Lesson stages:** Upcoming → Live now (Join button) → Ended → Recorded.
4. **Recording:** after the class, the teacher adds the recording to the **same lesson**,
   either as an **upload** or a **link** (YouTube unlisted / Vimeo / Bunny). Uploaded
   recordings follow the offline download rules.
5. **Missed class:** if the class ended and no recording exists yet, the student sees
   "Recording coming soon". Once added, the lesson plays like any recorded video.
6. **Attendance:** taken for live lessons the same way as for live classes.
7. **Reminders:** **1 hour and 15 minutes** before the start, by **in-app notification and WhatsApp**.
8. **Publishing:** a live lesson counts as content for the "at least 1 content" publish
   check. The teacher can add live lessons after the course is published.
9. **Existing live classes:** the separate live classes list stays as it is, for classes
   that don't belong to a module (e.g. a general doubt session).
10. **Join only on time:** for every live class and live lesson, students get the Join button
    and the Meet link only from **10 minutes before the start until the end**. Before that they
    see the date and time. WhatsApp messages link to the class page in the app, not to Meet.
    (Demo requests are unchanged: the visitor gets the Meet link on WhatsApp.)

## Automatic attendance (added 2026-11-18)
1. When a student taps **Join** on a live class or live lesson (web or app), they are marked
   **present automatically** (`POST /student/live-classes/:id/join`). The teacher does not mark it by hand.
2. Join works only in the join window (10 min before start until the end) and only when the Meet
   link exists. Joining again after a network drop keeps one record.
3. Meet opens even if marking fails, so a student is never blocked from the class.
4. Students who never tap Join have no record and are shown as **not marked** (counted absent).
   The teacher's attendance sheet stays for **corrections only** (e.g. a student who joined from
   another device).
5. Limit: Google Meet does not tell us who actually stayed in the call, so "present" means
   "joined through the app or website".

## Solution image on questions (added 2026-11-18)
1. When adding or editing a question, the teacher can upload **one optional solution image**
   (e.g. a photo of a maths sum solved on paper). JPG, PNG or WebP, up to 5 MB, checked by content.
2. Students see it **only where the explanation is shown**: the answer review after submitting,
   and the instant feedback in practice exams. Never on the question paper itself.
3. Files are private (signed links), uploaded with `POST /uploads` kind `solution`. A question can
   only use the teacher's own solution uploads. Excel import does not carry images.

## Course thumbnail is optional (added 2026-11-19)
1. A course can be published **without a thumbnail**. Publishing still needs a title, a
   description, demo video 1 and at least one lesson.
2. Where a course has no thumbnail, the web shows a **generated cover** instead: the course
   subject and title on a brand-colour background (colours from the design tokens).
3. The upload stays in the course editor as an optional field. The mobile app shows no course
   thumbnails, so it needs no change.

## Demo video 2 is optional (added 2026-11-19)
1. **Demo video 1 is required** to publish a course. **Demo video 2 is optional.**
2. The public course page and the app show however many demo videos the course has (1 or 2).
3. Public text says "demo video" instead of "2 demo videos".

## White page background (added 2026-11-19)
1. Every page (public site, student, teacher, admin, and the mobile app) uses a **white** page
   background. This overrides BRAND-THEME "Page background is Ice".
2. Section backgrounds (e.g. a doubt reply box) use a very light navy tint (Navy 4%) instead of Ice.
3. Ice stays in the palette for status badges (Draft / Paused / Expired) and thumbnails.

## Still open
- Brand / product name, logo, colours **(placeholder: "LMS")**
- Student audience (school / college / competitive exams / skills) **(assumed: school + competitive exam coaching in Maharashtra)**
- Design references the owner likes or dislikes
- Any extra content in LMS.pdf
