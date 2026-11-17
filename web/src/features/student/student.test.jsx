import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components';
import { AuthContext } from '../../app/AuthProvider';
import * as client from '../../api/client';
import { ExamRunner } from './ExamTakePage';
import CoursePlayerPage from './CoursePlayerPage';
import StudentExamsPage from './StudentExamsPage';
import EnrollPage from './EnrollPage';

function wrap(ui, { path = '/', route = '/', user = { role: 'student', name: 'Meera' } } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user, loading: false, refreshMe: vi.fn(), setUser: vi.fn() }}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={route} element={ui} />
              <Route path="/student/attempts/:attemptId/result" element={<p>Result page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const paper = (deadlineMs) => ({
  attemptId: 'a-1', examId: 9, title: 'Unit Test 1', mode: 'mock', deadlineAt: deadlineMs ? new Date(Date.now() + deadlineMs).toISOString() : null,
  questions: [
    { id: 1, type: 'mcq', text: '2 + 2 = ?', marks: 1, options: [{ id: 11, text: '3' }, { id: 12, text: '4' }] },
    { id: 2, type: 'fill_blank', text: 'Capital of Maharashtra?', marks: 1, options: [] },
  ],
  answers: {},
});

test('exam: countdown from the server deadline, autosave, offline notice', async () => {
  const put = vi.spyOn(client.api, 'put')
    .mockResolvedValueOnce({ data: { saved: true } })
    .mockRejectedValueOnce(new client.ApiError(0, 'offline', 'NETWORK'));
  wrap(<ExamRunner paper={paper(10 * 60000)} />);
  expect(screen.getByRole('timer')).toHaveTextContent(/^(10:00|9:59)$/);
  await userEvent.click(screen.getByRole('radio', { name: '4' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/student/attempts/a-1/answers/1', { optionId: 12 }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/your answer/i), 'Mumbai');
  await waitFor(() => expect(screen.getByText('Offline — answers will sync')).toBeInTheDocument(), { timeout: 3000 });
});

test('exam: submits automatically when the timer reaches zero', async () => {
  vi.spyOn(client.api, 'put').mockResolvedValue({ data: { saved: true } });
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { attemptId: 'a-1', score: 1, max: 2 } });
  wrap(<ExamRunner paper={paper(1200)} />);
  await waitFor(() => expect(post).toHaveBeenCalledWith('/student/attempts/a-1/submit'), { timeout: 4000 });
  expect(await screen.findByText('Result page')).toBeInTheDocument();
});

test('player: Mark complete updates the progress bar', async () => {
  let done = false;
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/student/courses/3') {
      return { data: { courseId: 3, title: 'Maths', readOnly: false, progressPct: done ? 50 : 0, subjects: [{ id: 1, name: 'Algebra', modules: [{ id: 1, name: 'M1', contents: [
        { id: 5, title: 'Lesson A', type: 'link', completed: done, locked: false }, { id: 6, title: 'Lesson B', type: 'link', completed: false, locked: false },
      ] }] }] } };
    }
    return { data: { id: 5, title: 'Lesson A', type: 'link', url: 'https://example.com', lastPositionSec: 0, completed: done } };
  });
  vi.spyOn(client.api, 'post').mockImplementation(async () => {
    done = true;
    return { data: { saved: true } };
  });
  wrap(<CoursePlayerPage />, { path: '/student/courses/3', route: '/student/courses/:courseId' });
  expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as complete' }));
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50'));
});

test('exams: a locked Final explains how to unlock it', async () => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/student/dashboard') return { data: { myCourses: [{ courseId: 3, title: 'Maths', readOnly: false }], upcomingLiveClasses: [], requests: [] } };
    return { data: [
      { id: 1, title: 'Unit Test 1', category: 'unit_test_1', mode: 'mock', locked: false, attemptsLeft: 1, best: null, openAttemptId: null },
      { id: 2, title: 'Final', category: 'final', mode: 'mock', locked: true, attemptsLeft: 1, best: null, openAttemptId: null },
    ] };
  });
  wrap(<StudentExamsPage />);
  expect(await screen.findByText('Finish all Unit Tests to unlock the Final Exam.')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Start' })).toHaveLength(1);
});

test('enroll: a logged-in student sends the request; a visitor sees registration', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { slug: 'maths-10', title: 'Class 10 Maths', teacher: { name: 'Suresh' }, demoVideos: [], curriculum: [], batches: [] } });
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { status: 'pending' } });
  wrap(<EnrollPage />, { path: '/enroll/maths-10', route: '/enroll/:slug' });
  await userEvent.click(await screen.findByRole('button', { name: 'Send enrollment request' }));
  expect(post).toHaveBeenCalledWith('/student/enrollments', { courseSlug: 'maths-10', message: null });
  expect(await screen.findByText("Request sent. You'll be notified when Suresh approves it.")).toBeInTheDocument();
});

test('enroll: visitor is asked to register', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { slug: 'maths-10', title: 'Class 10 Maths', teacher: { name: 'Suresh' }, demoVideos: [], curriculum: [], batches: [] } });
  wrap(<EnrollPage />, { path: '/enroll/maths-10', route: '/enroll/:slug', user: null });
  expect(await screen.findByRole('heading', { name: /create your student account/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
});
