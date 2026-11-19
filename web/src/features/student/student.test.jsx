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
import { ResultPage, StudentDashboard, StudentLiveClassesPage, StudentMyCoursesPage } from './StudentPages';

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

test.each([
  ['upcoming', false, false],
  ['live', false, false],
  ['ended', true, true],
])('player: a %s live lesson shows Mark as complete = %s', async (stage, canComplete, shown) => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/student/courses/3') {
      return { data: { courseId: 3, title: 'Maths', readOnly: false, progressPct: 0, subjects: [{ id: 1, name: 'Algebra', modules: [{ id: 1, name: 'M1', contents: [
        { id: 7, title: 'Live doubt session', type: 'live', completed: false, locked: false, live: { stage, startsAt: '2026-06-15T12:30:00Z', durationMin: 60 } },
      ] }] }] } };
    }
    return { data: { id: 7, title: 'Live doubt session', type: 'live', url: null, lastPositionSec: 0, completed: false, canComplete,
      live: { stage, startsAt: '2026-06-15T12:30:00Z', durationMin: 60, meetLink: stage === 'ended' ? undefined : 'https://meet.google.com/abc-defg-hij' } } };
  });
  wrap(<CoursePlayerPage />, { path: '/student/courses/3', route: '/student/courses/:courseId' });
  expect(await screen.findByRole('heading', { name: 'Live doubt session' })).toBeInTheDocument();
  if (shown) expect(await screen.findByRole('button', { name: 'Mark as complete' })).toBeInTheDocument();
  else expect(screen.queryByRole('button', { name: 'Mark as complete' })).not.toBeInTheDocument();
});

const classes = [
  { id: 1, topic: 'Tomorrow class', course: 'Maths', startsAt: '2099-06-16T12:30:00Z', durationMin: 60, stage: 'upcoming', canJoin: false },
  { id: 2, topic: 'Now class', course: 'Maths', startsAt: '2026-06-15T12:30:00Z', durationMin: 60, stage: 'live', canJoin: true, meetLink: 'https://meet.google.com/abc-defg-hij' },
];

test.each([
  ['dashboard', <StudentDashboard key="d" />, '/student/dashboard', { myCourses: [], upcomingLiveClasses: classes, requests: [] }],
  ['live classes page', <StudentLiveClassesPage key="l" />, '/student/live-classes', classes],
])('%s: Join only for a class that can be joined now', async (_name, ui, url, data) => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => (path === url ? { data } : { data: [] }));
  wrap(ui);
  const joins = await screen.findAllByRole('link', { name: 'Join' });
  expect(joins).toHaveLength(1);
  expect(joins[0]).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  expect(screen.getByText('Join opens 10 min before')).toBeInTheDocument();
});

test('clicking Join marks attendance automatically', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: classes });
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { present: true } });
  wrap(<StudentLiveClassesPage />);
  const join = await screen.findByRole('link', { name: 'Join' });
  join.addEventListener('click', (e) => e.preventDefault());
  await userEvent.click(join);
  expect(post).toHaveBeenCalledWith('/student/live-classes/2/join', {});
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

test('live classes page: class time without a link says the teacher will share it', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: [{ id: 3, topic: 'Waiting class', course: 'Maths', startsAt: '2026-06-15T12:30:00Z', durationMin: 60, stage: 'live', canJoin: false, waitingForLink: true }] });
  wrap(<StudentLiveClassesPage />);
  expect(await screen.findByText('The teacher will share the link soon')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
});

test('My courses lists every enrolled course with progress and an Open link', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: {
    myCourses: [{ courseId: 3, title: 'Maths', teacher: 'Suresh', batch: 'Morning', progressPct: 40, endDate: '2027-03-31', accessStatus: 'active', readOnly: false }],
    upcomingLiveClasses: [], requests: [],
  } });
  wrap(<StudentMyCoursesPage />);
  expect(await screen.findByRole('heading', { level: 1, name: 'My courses' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Maths' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/student/courses/3');
});

test('My courses with no enrollment points to Browse courses', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { myCourses: [], upcomingLiveClasses: [], requests: [] } });
  wrap(<StudentMyCoursesPage />);
  expect(await screen.findByRole('button', { name: 'Browse courses' })).toBeInTheDocument();
});

test('result review shows the solution image under the explanation', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: {
    exam: { title: 'Unit Test 1' }, submittedAt: '2026-06-15T03:00:00Z', score: 0, max: 1, pct: 0, passed: null, rank: null, of: 1,
    review: [{ questionId: 1, type: 'fill_blank', text: '12 x 12 = ?', options: [], yourAnswer: { text: '124' }, correct: false, marks: 0,
      correctAnswer: { acceptedAnswers: ['144'] }, explanation: 'Multiply', explanationImageUrl: '/api/v1/files/solution/abc.png?exp=1&sig=a' }],
  } });
  wrap(<ResultPage />, { path: '/r/a-1', route: '/r/:attemptId' });
  const img = await screen.findByRole('img', { name: /solution image/i });
  expect(img.getAttribute('src')).toContain('/files/solution/abc.png');
});
