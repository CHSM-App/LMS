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
