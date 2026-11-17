// Sidebar items per role. Items are added as each phase lands.
export const ADMIN_NAV = [
  { to: '/admin', label: 'common.dashboard', end: true },
  { to: '/admin/teacher-requests', label: 'nav.teacherRequests' },
  { to: '/admin/teachers', label: 'nav.teachers' },
  { to: '/admin/subscriptions', label: 'nav.subscriptions' },
  { to: '/notifications', label: 'nav.notifications' },
  { to: '/admin/audit-log', label: 'nav.auditLog' },
];

export const TEACHER_NAV = [
  { to: '/teacher', label: 'common.dashboard', end: true },
  { to: '/teacher/courses', label: 'nav.courses' },
  { to: '/teacher/question-bank', label: 'nav.questionBank' },
  { to: '/teacher/exams', label: 'nav.exams' },
  { to: '/notifications', label: 'nav.notifications' },
];

export const STUDENT_NAV = [
  { to: '/student', label: 'common.dashboard', end: true },
  { to: '/notifications', label: 'nav.notifications' },
];

export const navFor = (role) => ({ admin: ADMIN_NAV, teacher: TEACHER_NAV, student: STUDENT_NAV }[role] || []);
