import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './AuthProvider';
import { AppShell } from './layouts/AppShell';
import { TEACHER_NAV, STUDENT_NAV } from './nav';
import * as client from '../api/client';
import TeacherDashboard from '../features/teacher/ops/TeacherDashboard';
import { StudentDashboard } from '../features/student/StudentPages';

function wrap(ui, { path = '/', user }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user, loading: false, logout: vi.fn() }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="*" element={ui} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const mockGet = (data) => vi.spyOn(client.api, 'get').mockResolvedValue({ data, pagination: { total: 0 } });
afterEach(() => vi.restoreAllMocks());

test('sidebar groups links, shows the role, and the top bar names the current page', () => {
  mockGet([]);
  wrap(<AppShell nav={TEACHER_NAV} />, { path: '/teacher/courses', user: { role: 'teacher', name: 'Priya Deshmukh' } });
  const side = screen.getByRole('complementary', { name: 'Main navigation' });
  expect(within(side).getByText('Teaching', { selector: '.shell__group-title' })).toBeInTheDocument();
  expect(within(side).getByText('Students', { selector: '.shell__group-title' })).toBeInTheDocument();
  expect(within(side).getAllByText('Teacher').length).toBeGreaterThan(0);
  expect(within(side).getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page');
  const top = screen.getByRole('banner');
  expect(within(top).getByRole('heading', { name: 'Courses' })).toBeInTheDocument();
});

test('student sidebar has its own groups', () => {
  mockGet([]);
  wrap(<AppShell nav={STUDENT_NAV} />, { path: '/student', user: { role: 'student', name: 'Rohan' } });
  const side = screen.getByRole('complementary', { name: 'Main navigation' });
  expect(within(side).getByText('Learning', { selector: '.shell__group-title' })).toBeInTheDocument();
  expect(within(side).getByRole('link', { name: 'Browse courses' })).toBeInTheDocument();
});

test('teacher dashboard: quick actions and tiles that flag what needs action', async () => {
  mockGet({ pendingDemoRequests: 2, pendingEnrollments: 0, openDoubts: 1, activeStudents: 4, todaysClasses: [] });
  wrap(<TeacherDashboard />, { path: '/teacher', user: { role: 'teacher', name: 'Priya' } });
  expect(await screen.findByRole('link', { name: 'New course' })).toHaveAttribute('href', '/teacher/courses');
  expect(screen.getByRole('link', { name: 'Schedule live class' })).toHaveAttribute('href', '/teacher/live-classes');
  expect(screen.getAllByText('Needs action')).toHaveLength(2);
});

test('student dashboard: next-up card and quick stats', async () => {
  mockGet({
    myCourses: [{ courseId: 5, title: 'Class 10 Maths', teacher: 'Priya', batch: 'Morning', progressPct: 36, endDate: '2027-11-18', accessStatus: 'active', readOnly: false, thumbnailUrl: null }],
    upcomingLiveClasses: [], requests: [],
  });
  wrap(<StudentDashboard />, { path: '/student', user: { role: 'student', name: 'Rohan' } });
  expect(await screen.findByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/student/courses/5');
  const stats = screen.getByRole('list', { name: 'Your summary' });
  expect(within(stats).getByText('Enrolled courses')).toBeInTheDocument();
  expect(within(stats).getByText('36%')).toBeInTheDocument();
});

test('student dashboard: live classes on the left (live-now first), compact My courses on the right', async () => {
  mockGet({
    myCourses: [{ courseId: 5, title: 'Class 10 Maths', teacher: 'Priya', batch: 'Morning', progressPct: 36, endDate: '2027-11-18', accessStatus: 'active', readOnly: false, thumbnailUrl: null }],
    upcomingLiveClasses: [
      { id: 1, topic: 'Tomorrow class', course: 'Maths', startsAt: '2099-06-16T12:30:00Z', durationMin: 60, stage: 'upcoming', canJoin: false },
      { id: 2, topic: 'Now class', course: 'Maths', startsAt: '2026-06-15T12:30:00Z', durationMin: 60, stage: 'live', canJoin: true, meetLink: 'https://meet.google.com/abc-defg-hij' },
    ],
    requests: [],
  });
  wrap(<StudentDashboard />, { path: '/student', user: { role: 'student', name: 'Rohan' } });
  const live = await screen.findByRole('region', { name: 'Live classes' });
  const rows = within(live).getAllByRole('listitem');
  expect(within(rows[0]).getByText('Now class')).toBeInTheDocument();
  expect(within(rows[0]).getByText('Live now')).toBeInTheDocument();
  // Live classes come first (left), My courses second (right, compact cards).
  const courses = screen.getByRole('region', { name: 'My courses' });
  expect(live.compareDocumentPosition(courses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(courses.querySelector('.my-courses--compact')).not.toBeNull();
  expect(screen.getByRole('heading', { level: 3, name: 'Class 10 Maths' })).toBeInTheDocument();
});

const course = (id) => ({ courseId: id, title: `Course ${id}`, teacher: 'Priya', batch: null, progressPct: 10, endDate: '2027-11-18', accessStatus: 'active', readOnly: false, thumbnailUrl: null });
const cls = (id) => ({ id, topic: `Class ${id}`, course: 'Maths', startsAt: `2099-06-${10 + id}T12:30:00Z`, durationMin: 60, stage: 'upcoming', canJoin: false });

test('student dashboard: "All" links only when there is more than fits', async () => {
  mockGet({ myCourses: [course(1)], upcomingLiveClasses: [cls(1)], requests: [] });
  const { unmount } = wrap(<StudentDashboard />, { path: '/student', user: { role: 'student', name: 'Rohan' } });
  await screen.findByRole('region', { name: 'My courses' });
  expect(screen.queryByRole('link', { name: /all my courses/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /all live classes/i })).not.toBeInTheDocument();
  unmount();
  vi.restoreAllMocks();

  mockGet({ myCourses: [1, 2, 3, 4, 5].map(course), upcomingLiveClasses: [1, 2, 3, 4, 5, 6].map(cls), requests: [] });
  wrap(<StudentDashboard />, { path: '/student', user: { role: 'student', name: 'Rohan' } });
  const courses = await screen.findByRole('region', { name: 'My courses' });
  expect(within(courses).getAllByRole('heading', { level: 3 })).toHaveLength(3);
  expect(within(courses).getByRole('link', { name: 'All my courses (5)' })).toHaveAttribute('href', '/student/courses');
  const live = screen.getByRole('region', { name: 'Live classes' });
  expect(within(live).getAllByRole('listitem')).toHaveLength(4);
  expect(within(live).getByRole('link', { name: 'All live classes (6)' })).toHaveAttribute('href', '/student/live-classes');
});
