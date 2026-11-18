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
| Google Meet | **Created automatically** through the Google Calendar API (Workspace account). **Fallback:** the teacher pastes a link. |
| OTP | SMS provider (DLT-registered template). |
| Videos (lessons + 2 demo videos) | **Both options:** the teacher picks either a **link** (YouTube unlisted / Vimeo / Bunny Stream) or an **upload** for each video. Uploads are chunked and resumable, with a progress bar. |

## Rules
| Topic | Decision |
|---|---|
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

## Still open
- Brand / product name, logo, colours **(placeholder: "LMS")**
- Student audience (school / college / competitive exams / skills) **(assumed: school + competitive exam coaching in Maharashtra)**
- Design references the owner likes or dislikes
- Any extra content in LMS.pdf
