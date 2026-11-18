import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components';
import * as client from '../../../api/client';
import { ProfilePage } from './DoubtsProgramsProfile';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const profile = { name: 'Suresh Patil', email: null, subjects: 'Maths', experienceYears: 8, publicSlug: 'suresh-patil', socialLinks: {} };
const course = {
  id: 3, title: 'Class 10 Maths', subject: 'Maths', language: 'mr', description: 'Full SSC syllabus.', durationText: '10 months',
  feeDisplay: '₹3000 / year', thumbnailKey: 'thumbnail/a.png', thumbnailUrl: '/files/thumbnail/a.png',
  demoVideo1: { source: 'youtube', url: 'https://youtu.be/abc' },
  demoVideo2: { source: 'upload', fileKey: 'demo_video/b.mp4', url: '/files/demo_video/b.mp4' },
  status: 'published',
};

function mockApi() {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/teacher/profile') return { data: profile };
    if (path === '/teacher/courses') return { data: [course] };
    return { data: [] };
  });
  return vi.spyOn(client.api, 'put').mockResolvedValue({ data: {} });
}

test('public profile page lets the teacher set each course fee', async () => {
  const put = mockApi();
  wrap(<ProfilePage />);
  const fee = await screen.findByLabelText(/Class 10 Maths/);
  expect(fee).toHaveValue('₹3000 / year');
  await userEvent.clear(fee);
  await userEvent.type(fee, '₹4000 / year');
  await userEvent.click(screen.getByRole('button', { name: /save fees/i }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/teacher/courses/3', {
    title: 'Class 10 Maths', subject: 'Maths', language: 'mr', description: 'Full SSC syllabus.', durationText: '10 months',
    feeDisplay: '₹4000 / year', thumbnailKey: 'thumbnail/a.png',
    demoVideo1: { source: 'youtube', url: 'https://youtu.be/abc' },
    demoVideo2: { source: 'upload', fileKey: 'demo_video/b.mp4' },
  }));
});

test('unchanged course fees are not saved again', async () => {
  const put = mockApi();
  wrap(<ProfilePage />);
  await screen.findByLabelText(/Class 10 Maths/);
  await userEvent.click(screen.getByRole('button', { name: /save fees/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /save fees/i })).toBeEnabled());
  expect(put).not.toHaveBeenCalled();
});
