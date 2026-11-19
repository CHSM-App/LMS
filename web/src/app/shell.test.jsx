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
