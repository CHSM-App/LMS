import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components';
import * as client from '../../../api/client';
import { VideoSourceField, isValidVideoLink } from './VideoSourceField';
import { uploadResumable } from '../../../utils/upload';
import CourseEditorPage from './CourseEditorPage';

function wrap(ui, path = '/teacher/courses/7', route = '/teacher/courses/:courseId') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path={route} element={ui} /></Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

test('video links are checked per provider', () => {
  expect(isValidVideoLink('youtube', 'https://youtu.be/abcdefgh123')).toBe(true);
  expect(isValidVideoLink('youtube', 'https://example.com/v.mp4')).toBe(false);
  expect(isValidVideoLink('vimeo', 'https://vimeo.com/123456')).toBe(true);
  expect(isValidVideoLink('bunny', 'https://iframe.mediadelivery.net/embed/1234/abc-def')).toBe(true);
});

test('VideoSourceField shows an error for a wrong YouTube link', async () => {
  const onChange = vi.fn();
  render(<VideoSourceField label="Demo video 1" value={null} onChange={onChange} kind="demo_video" />);
  await userEvent.selectOptions(screen.getByLabelText(/video source/i), 'youtube');
  await userEvent.type(screen.getByLabelText(/video link/i), 'https://example.com/x');
  await userEvent.tab();
  expect(screen.getByText('Enter a valid YouTube link')).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText(/video link/i));
  await userEvent.type(screen.getByLabelText(/video link/i), 'https://youtu.be/abcdefgh123');
  await userEvent.tab();
  expect(onChange).toHaveBeenLastCalledWith({ source: 'youtube', url: 'https://youtu.be/abcdefgh123' });
});

test('resumable upload continues from where the server stopped after a failed chunk', async () => {
  const file = new File([new Uint8Array(12)], 'lesson.mp4', { type: 'video/mp4' });
  const calls = [];
  let failedOnce = false;
  vi.spyOn(client.api, 'post').mockImplementation(async (path) => {
    if (path === '/uploads/sessions') return { data: { uploadId: 'u1', chunkSize: 5, receivedBytes: 0 } };
    return { data: { key: 'video/abc.mp4' } };
  });
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: { receivedBytes: 5 } });
  vi.spyOn(client.api, 'putChunk').mockImplementation(async (path, blob, range) => {
    calls.push(range);
    if (range.startsWith('bytes 5-') && !failedOnce) {
      failedOnce = true;
      throw new client.ApiError(0, 'offline', 'NETWORK');
    }
    const end = Number(range.split('-')[1].split('/')[0]);
    return { data: { receivedBytes: end + 1 } };
  });
  const progress = [];
  const key = await uploadResumable('video', file, { onProgress: (p) => progress.push(p), retryDelayMs: 0 });
  expect(key).toBe('video/abc.mp4');
  expect(calls).toEqual(['bytes 0-4/12', 'bytes 5-9/12', 'bytes 5-9/12', 'bytes 10-11/12']);
  expect(progress[progress.length - 1]).toBe(100);
});

const course = {
  id: 7, title: 'Class 10 Maths', description: 'd', subject: 'Maths', language: 'mr', status: 'draft', slug: 'class-10-maths-abc',
  thumbnailUrl: null, demoVideo1: null, demoVideo2: null, readiness: { ready: false, missing: ['thumbnail', 'demo_video_2'] },
};

test('Publish shows what is missing', async () => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path.endsWith('/curriculum')) return { data: { subjects: [] } };
    if (path.endsWith('/batches')) return { data: [] };
    return { data: course };
  });
  vi.spyOn(client.api, 'post').mockRejectedValue(new client.ApiError(422, 'Finish these before publishing', 'NOT_READY', { missing: ['thumbnail', 'demo_video_2'] }));
  wrap(<CourseEditorPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Publish course' }));
  const box = await screen.findByRole('alert');
  expect(within(box).getByText('Add a thumbnail image')).toBeInTheDocument();
  expect(within(box).getByText('Add demo video 2')).toBeInTheDocument();
});

test('moving a module down sends the new order', async () => {
  const tree = { subjects: [{ id: 1, name: 'Algebra', modules: [{ id: 10, name: 'A', contents: [] }, { id: 11, name: 'B', contents: [] }] }] };
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path.endsWith('/curriculum')) return { data: tree };
    if (path.endsWith('/batches')) return { data: [] };
    return { data: course };
  });
  const put = vi.spyOn(client.api, 'put').mockResolvedValue({ data: {} });
  wrap(<CourseEditorPage />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Move A down' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/teacher/subjects/1/modules/order', { moduleIds: [11, 10] }));
});
