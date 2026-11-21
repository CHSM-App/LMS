// Sidebar items per role, in groups. `group` is the i18n key of the group heading (null = no heading).
export const ADMIN_NAV = [
  { group: null, items: [
    { to: '/admin', label: 'common.dashboard', icon: 'dashboard', end: true },
  ] },
  { group: 'nav.groupTeachers', items: [
    { to: '/admin/teacher-requests', label: 'nav.teacherRequests', icon: 'inbox' },
    { to: '/admin/teachers', label: 'nav.teachers', icon: 'users' },
    { to: '/admin/subscriptions', label: 'nav.subscriptions', icon: 'card' },
  ] },
  { group: 'nav.groupSystem', items: [
    { to: '/admin/audit-log', label: 'nav.auditLog', icon: 'history' },
  ] },
];

export const TEACHER_NAV = [
  { group: null, items: [
    { to: '/teacher', label: 'common.dashboard', icon: 'dashboard', end: true },
  ] },
  { group: 'nav.groupStudents', items: [
    { to: '/teacher/requests', label: 'nav.requests', icon: 'inbox' },
    { to: '/teacher/students', label: 'nav.students', icon: 'users' },
    { to: '/teacher/doubts', label: 'nav.doubts', icon: 'help' },
  ] },
  { group: 'nav.groupTeaching', items: [
    { to: '/teacher/courses', label: 'nav.courses', icon: 'book' },
    { to: '/teacher/live-classes', label: 'nav.liveClasses', icon: 'video' },
    { to: '/teacher/question-bank', label: 'nav.questionBank', icon: 'list' },
    { to: '/teacher/exams', label: 'nav.exams', icon: 'clipboard' },
    { to: '/teacher/programs', label: 'nav.programs', icon: 'calendar' },
  ] },
  { group: 'nav.groupProfile', items: [
    { to: '/teacher/profile', label: 'nav.profile', icon: 'user' },
  ] },
];

export const STUDENT_NAV = [
  { group: null, items: [
    { to: '/student', label: 'common.dashboard', icon: 'dashboard', end: true },
  ] },
  { group: 'nav.groupLearning', items: [
    { to: '/student/courses', label: 'nav.myCourses', icon: 'book' },
    { to: '/student/live-classes', label: 'nav.liveClasses', icon: 'video' },
    { to: '/student/exams', label: 'nav.exams', icon: 'clipboard' },
    { to: '/student/progress', label: 'nav.progress', icon: 'chart' },
    { to: '/student/attendance', label: 'nav.attendance', icon: 'check' },
    { to: '/student/doubts', label: 'nav.doubts', icon: 'help' },
  ] },
  { group: 'nav.groupDiscover', items: [
    { to: '/student/browse', label: 'nav.browse', icon: 'compass' },
    { to: '/student/profile', label: 'nav.profile', icon: 'user' },
  ] },
];

export const navFor = (role) => ({ admin: ADMIN_NAV, teacher: TEACHER_NAV, student: STUDENT_NAV }[role] || []);

// The nav item for the current path: the longest matching `to`, so /teacher/courses/7 → Courses.
export function activeItem(nav, pathname) {
  let best = null;
  for (const g of nav) {
    for (const it of g.items) {
      const hit = it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`);
      if (hit && (!best || it.to.length > best.to.length)) best = it;
    }
  }
  return best;
}
