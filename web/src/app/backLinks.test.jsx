import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './AuthProvider';
import * as client from '../api/client';
import { BackLink } from '../components';
import TeacherPublicPage from '../features/public/TeacherPublicPage';
import EnrollPage from '../features/student/EnrollPage';
import { FinalResultPage } from '../features/student/StudentPages';

function wrap(ui, path, route, user = { role: 'student', name: 'Rohan' }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user, loading: false }}>
        <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const course = { slug: 'maths-10', title: 'Class 10 Maths', teacher: { name: 'Suresh', slug: 'suresh' } };

test('BackLink is a link with an arrow and its label', () => {
  wrap(<BackLink to="/student/courses">Back to my courses</BackLink>, '/', '/');
  expect(screen.getByRole('link', { name: 'Back to my courses' })).toHaveAttribute('href', '/student/courses');
});

test('teacher page inside the student area leads back to Browse courses', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { name: 'Suresh', courses: [], socialLinks: {} } });
  wrap(<TeacherPublicPage />, '/student/browse/teachers/suresh', '/student/browse/teachers/:slug');
  expect(await screen.findByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/student/browse');
});

test('teacher page on the public site leads back to the public catalogue', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { name: 'Suresh', courses: [], socialLinks: {} } });
  wrap(<TeacherPublicPage />, '/teachers/suresh', '/teachers/:slug', null);
  expect(await screen.findByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/courses');
});

test('enroll page leads back to the course it is for', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: course });
  wrap(<EnrollPage />, '/student/enroll/maths-10', '/student/enroll/:slug');
  expect(await screen.findByRole('link', { name: 'Back to course' })).toHaveAttribute('href', '/student/browse/maths-10');
});

test('final result leads back to the course', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { weightedPct: 70, passed: true, passMark: 40, exams: [] } });
  wrap(<FinalResultPage />, '/student/courses/3/final-result', '/student/courses/:courseId/final-result');
  expect(await screen.findByRole('link', { name: 'Back to course' })).toHaveAttribute('href', '/student/courses/3');
});
