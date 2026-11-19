import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components';
import { AuthContext } from '../../app/AuthProvider';
import * as client from '../../api/client';
import HomePage from './HomePage';
import CourseDetailsPage from './CourseDetailsPage';
import { LiveDemoForm } from './LiveDemoForm';
import { CourseCard } from './CourseCard';

function wrap(ui, path = '/', route = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user: null, loading: false }}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes><Route path={route} element={ui} /></Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const card = { slug: 'maths-10', title: 'Class 10 Maths', subject: 'Maths', language: 'mr', thumbnailUrl: null, teacher: { name: 'Suresh', slug: 'suresh' } };

test('home lists course cards and searches after typing stops', async () => {
  const get = vi.spyOn(client.api, 'get').mockImplementation(async (path, q) => {
    if (path === '/public/filters') return { data: { languages: ['mr'], subjects: ['Maths'] } };
    return { data: q && q.q === 'zzz' ? [] : [card], pagination: { page: 1, limit: 12, total: 1 } };
  });
  wrap(<HomePage />);
  expect(await screen.findByRole('link', { name: /class 10 maths/i })).toHaveAttribute('href', '/courses/maths-10');
  expect(screen.getByText('Suresh')).toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  await waitFor(() => expect(get).toHaveBeenCalledWith('/public/courses', expect.objectContaining({ q: 'zzz' })), { timeout: 2000 });
  expect(await screen.findByText(/no courses match/i)).toBeInTheDocument();
});

test('home: hero with subject chips that filter the list', async () => {
  const get = vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/public/filters') return { data: { languages: ['mr'], subjects: ['Maths', 'Web Development'] } };
    return { data: [card], pagination: { page: 1, limit: 12, total: 1 } };
  });
  wrap(<HomePage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Find the right teacher. Watch a free demo first.' })).toBeInTheDocument();
  const chips = await screen.findByRole('group', { name: 'Popular subjects' });
  expect(within(chips).getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
  await userEvent.click(await within(chips).findByRole('button', { name: 'Web Development' }));
  expect(within(chips).getByRole('button', { name: 'Web Development', pressed: true })).toBeInTheDocument();
  await waitFor(() => expect(get).toHaveBeenCalledWith('/public/courses', expect.objectContaining({ subject: 'Web Development' })));
});

test('home: how it works in 3 steps, and a call to teachers', async () => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/public/filters') return { data: { languages: [], subjects: [] } };
    return { data: [card], pagination: { page: 1, limit: 12, total: 1 } };
  });
  wrap(<HomePage />);
  const steps = screen.getByRole('list', { name: 'How it works' });
  expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
  expect(within(steps).getByText('Watch the demo video')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start teaching' })).toHaveAttribute('href', '/become-teacher');
});

test('course card shows the teacher, language, fee and the free demo tag', () => {
  wrap(<CourseCard course={{ ...card, feeDisplay: '₹2,500', teacher: { ...card.teacher, photoUrl: '/api/v1/files/photo/p.png' } }} />);
  expect(screen.getByText('Suresh')).toBeInTheDocument();
  expect(screen.getByText('Marathi')).toBeInTheDocument();
  expect(screen.getByText('₹2,500')).toBeInTheDocument();
  expect(screen.getByText('Free live demo')).toBeInTheDocument();
});

test('a course without a thumbnail gets a generated cover with its subject and title', () => {
  wrap(<CourseCard course={card} />);
  const cover = screen.getByTestId('course-cover');
  expect(within(cover).getByText('Maths')).toBeInTheDocument();
  expect(within(cover).getByText('Class 10 Maths')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('a course with a thumbnail shows the image, not the generated cover', () => {
  const { container } = wrap(<CourseCard course={{ ...card, thumbnailUrl: '/api/v1/files/thumbnail/a.png' }} />);
  expect(container.querySelector('.course-card__thumb img')).toBeInTheDocument();
  expect(screen.queryByTestId('course-cover')).not.toBeInTheDocument();
});

const details = {
  slug: 'maths-10', title: 'Class 10 Maths', description: 'Full SSC syllabus.', subject: 'Maths', language: 'mr', feeDisplay: '₹3000 / year',
  demoVideos: [{ source: 'youtube', url: 'https://youtu.be/abcdefgh123' }, { source: 'vimeo', url: 'https://vimeo.com/123456' }],
  batches: [], curriculum: [{ name: 'Algebra', modules: [{ name: 'Linear equations', contents: [{ title: 'Intro', type: 'video', isFreePreview: false }] }] }],
  teacher: { name: 'Suresh', slug: 'suresh', bio: 'Ten years', experienceYears: 10 },
};

test('course details shows both demo videos, Live Demo and Enroll Now', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: details });
  wrap(<CourseDetailsPage />, '/courses/maths-10', '/courses/:slug');
  expect(await screen.findByRole('heading', { level: 1, name: 'Class 10 Maths' })).toBeInTheDocument();
  expect(screen.getAllByTitle(/demo video/i)).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Book a free live demo' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Enroll now' })).toHaveAttribute('href', '/enroll/maths-10');
  expect(screen.getByText('Linear equations')).toBeInTheDocument();
});

test('live demo form: required fields, OTP step keeps values on Back, success message', async () => {
  const post = vi.spyOn(client.api, 'post').mockImplementation(async (path) => {
    if (path === '/auth/otp/send') return { data: { sent: true, resendAfterSec: 30 } };
    return { data: { status: 'pending', teacherName: 'Suresh' } };
  });
  wrap(<LiveDemoForm courseSlug="maths-10" />);
  await userEvent.click(screen.getByRole('button', { name: 'Verify mobile number' }));
  expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
  expect(post).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText(/^name/i), 'Ravi');
  await userEvent.type(screen.getByLabelText(/mobile number/i), '9822200001');
  await userEvent.type(screen.getByLabelText(/^education/i), '10th');
  await userEvent.click(screen.getByLabelText(/i agree to the/i));
  await userEvent.click(screen.getByRole('button', { name: 'Verify mobile number' }));
  expect(await screen.findByRole('group', { name: /one-time password/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  expect(screen.getByLabelText(/^name/i)).toHaveValue('Ravi');
  await userEvent.click(screen.getByRole('button', { name: 'Verify mobile number' }));
  const otp = await screen.findByRole('group', { name: /one-time password/i });
  const boxes = within(otp).getAllByRole('textbox');
  for (let i = 0; i < 6; i += 1) await userEvent.type(boxes[i], String(i + 1));
  await userEvent.click(screen.getByRole('button', { name: 'Send demo request' }));
  expect(await screen.findByText('Request sent. Suresh will message you on WhatsApp with the date and time.')).toBeInTheDocument();
  expect(post).toHaveBeenLastCalledWith('/public/demo-requests', expect.objectContaining({ courseSlug: 'maths-10', name: 'Ravi', otp: '123456', acceptTerms: true, whatsappOptIn: true }));
});

test('signed-in student browses inside the student area: cards and Enroll stay under /student', async () => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/public/filters') return { data: { languages: ['mr'], subjects: ['Maths'] } };
    if (path === '/public/courses') return { data: [card], pagination: { page: 1, limit: 12, total: 1 } };
    return { data: details };
  });
  const { unmount } = wrap(<HomePage />, '/student/browse', '/student/browse');
  expect(await screen.findByRole('link', { name: /class 10 maths/i })).toHaveAttribute('href', '/student/browse/maths-10');
  expect(screen.getByRole('heading', { level: 1, name: 'Browse courses' })).toBeInTheDocument();
  unmount();
  wrap(<CourseDetailsPage />, '/student/browse/maths-10', '/student/browse/:slug');
  expect(await screen.findByRole('link', { name: 'Enroll now' })).toHaveAttribute('href', '/student/enroll/maths-10');
  expect(screen.getByRole('link', { name: /more from/i })).toHaveAttribute('href', '/student/browse/teachers/suresh');
});
