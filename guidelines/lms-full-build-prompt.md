# LMS End-to-End Build Prompt (Workflow + Page-wise Fields)


## 1. Product
One common website + mobile app. Three roles: Super Admin, Teacher, Student. All logins use mobile number + OTP (no passwords). No online payment. "Subscription" means an access period (start date, end date, status), not a payment.


## 3. End-to-end workflow

### 3.1 Teacher onboarding
1. Teacher opens "Become a Teacher" and fills the registration form.
2. Mobile OTP is verified; request is saved as Pending.
3. Super Admin gets a notification.
4. Admin accepts or rejects (reject needs a reason; rejected teacher can reapply).
5. If accepted, teacher logs in with mobile + OTP and lands on the Teacher Dashboard.

### 3.2 Super Admin scope (only this)
Approve or reject teachers, block or activate teachers, manage teacher subscriptions, see student count under each teacher, receive notifications. Admin does not manage courses, content or exams.

### 3.3 Student: browse and live demo
1. Student opens the website and sees all teachers' courses, no login needed.
2. Selects a course: details page with full details, exactly 2 demo videos, "Live Demo" and "Enroll Now" buttons.
3. Live Demo opens an enquiry form (name, mobile, OTP verify, education, more).
4. The request goes to that course's teacher, who sets date and time and generates a Google Meet link.
5. The link is sent to the student on WhatsApp.
6. After the demo, the student either stops or clicks Enroll Now.

### 3.4 Student: enroll and learn
1. Student selects a course and clicks Enroll Now.
2. Student registration: name, mobile, OTP verify, other details.
3. An enrollment request goes to the teacher; teacher approves and sets the subscription for that student and course.
4. Student logs in with mobile + OTP and opens the Student Dashboard.

## 4. Page-wise fields
`*` = required. "(suggested)" = optional field I proposed.

### Super Admin
- **Teacher requests (review):** name*, mobile*, course*, subject*, experience*, status, reject reason, Accept / Reject buttons
- **Teacher list:** name, mobile, subject, status, joined date, student count, Block / Activate
- **Subscription management:** teacher*, plan*, start date*, end date*, status, student count
- **Notifications:** title, message, date, read/unread

### Teacher
- **Registration:** name*, mobile*, OTP*, course*, subject*, experience in years*, email (suggested), city (suggested), qualification (suggested), photo (suggested), ID/certificate upload (suggested)
- **Login:** mobile*, OTP*
- **Create / edit course:** title*, description*, subject*, language*, thumbnail*, duration, fee (display only), demo video 1*, demo video 2*, status (Draft / Pending / Published)
- **Subject:** name*, course*, description
- **Module:** name*, subject*, order number
- **Content (per module):** title*, type (video / PDF / link)*, file or URL*, order, free preview
- **Live class schedule:** course*, topic*, date*, time*, Meet link*, status
- **Question bank (per module):** question*, type*, options, correct answer(s)*, module*, subject*, difficulty, marks, negative marks, explanation. Add by manual entry or Excel import.
- **Create exam / test:** see section 5
- **Student list:** name, mobile, course, enrolled date, subscription status
- **Enrollment and demo requests:** student name, mobile, education, course, message, date/time to set, Meet link, "Send on WhatsApp", Approve / Reject
- **Attendance:** live class*, student*, present/absent*, date
- **Doubts:** student, course, question, attachment, reply*, status
- **Results:** student, exam, marks, rank, date
- **Class programs:** title*, date*, time*, batch
- **Login access and subscription per student:** student*, course*, start date*, end date*, status, access on/off
- **Profile and public profile editor:** name*, mobile, email, photo, bio, subjects, experience, intro video, social links, language
- **Notifications:** title, message, date, read/unread

### Student (public)
- **Home (course list):** thumbnail, title, teacher, language, search (suggested), filter (suggested)
- **Course details:** title, full description, modules overview, teacher info, 2 demo videos, Live Demo button, Enroll Now button
- **Live demo request form:** name*, mobile*, OTP*, education*, class/standard (suggested), preferred time (suggested), message (suggested)
- **Registration:** name*, mobile*, OTP*, education*, city (suggested), email (suggested)
- **Login:** mobile*, OTP*

### Student dashboard
- **My courses:** course, teacher, progress %, subscription end date
- **All public courses:** course list, Enroll button
- **Enrollment requests sent:** course, date, status (Pending / Approved / Rejected)
- **Live class:** topic, date, time, Join button (Meet link)
- **Course player:** video, module list, mark complete, progress
- **Notes viewer:** PDF title, view, download
- **Tests and exams:** question, options, timer, submit
- **Results and answer review:** marks, rank, correct/wrong answers, explanation
- **Doubts and discussion:** question*, course, attachment, teacher reply
- **Attendance and progress:** attendance %, completed lessons, exam performance
- **Profile and notifications:** name, mobile, education, photo, notification list

## 5. Exam system
- Each module has its own question bank (Module 1 -> Bank 1, Module 2 -> Bank 2, and so on). Questions already used in a test are archived, never hard-deleted.
- Question types: MCQ, True/False, Fill in the blanks, Multiple correct answers. Add by manual entry or bulk Excel import (downloadable template, per-row error report).
- **Exam setup, teacher chooses:**
  1. **Scope:** single module, multiple modules, or full course
  2. **Mode:** Practice (no timer, answers shown instantly, unlimited attempts, not counted) or Mock (timer with auto-submit, passing %, attempt limit, result after submit)
  3. **Question selection:** manual, or random (questions per module, easy/medium/hard mix)
  4. **Category and weightage:** Unit Test 1, Unit Test 2, Final Exam, Practice (example 20% / 20% / 60%)
- **Other options:** total marks, negative marking, time limit, passing percentage, shuffle questions and options, attempt limit, start and end date.
- **Random test rules:** each student gets their own questions, fixed once the attempt starts; answers autosave; the student can resume after a network drop with the timer still running; block saving the test if a module has too few questions.
- **Final result:** weighted total of graded exams, shown with per-exam marks, pass/fail and a module-wise breakdown. Final Exam unlocks after the Unit Tests.

## 6. Security and quality rules
- OTP: expiry, resend limit, attempt limit.
- Role-based access checked on every API call.
- A student's mobile number is never visible to other students.
- Audit log for admin actions.
- If a teacher is blocked, their students keep read-only access to completed content.
- Demo videos are watchable without login and after login.

## 7. Notifications
In-app for all roles. WhatsApp for Meet links. SMS or WhatsApp for OTP. Statuses used everywhere: Pending, Approved, Rejected, Blocked.

## 8. Backend note
Hosting is static, so the backend (API, database, OTP, WhatsApp) is separate. Use the OpenAPI contract and a mock server. List the backend services needed in `BACKEND_NEEDS.md`.

## 9. Phases (run all in order)
1. Architecture: folders, ERD, OpenAPI, roles and permissions, i18n
2. Design system: tokens, typography, components
3. Auth: OTP login, registration, teacher onboarding, admin approval
4. Super Admin app
5. Teacher: courses, subjects, modules, content
6. Teacher: question bank, exams, results
7. Teacher: live classes, students, attendance, doubts, subscriptions, public profile
8. Student: public site, course details, live demo request flow
9. Student: enrollment, dashboard, player, exams, results
10. Notifications, Flutter parity, tests, static build for Plesk

Start now with Phase 1.
