import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../../components';
import * as client from '../../../../api/client';
import { CurriculumTab } from '../CurriculumTab';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const liveLesson = {
  id: 50, title: 'Live: factorisation', type: 'live', videoSource: null, fileKey: null, url: null, isFreePreview: false, sortOrder: 1,
  live: { liveClassId: 9, startsAt: '2099-06-15T12:30:00.000Z', durationMin: 60, batch: { id: 3, name: 'Morning' }, stage: 'upcoming', meetLink: 'https://meet.google.com/abc-defg-hij' },
  recording: null,
};

function mockApi(contents = []) {
  const tree = { subjects: [{ id: 1, name: 'Algebra', modules: [{ id: 10, name: 'Linear', contents }] }] };
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path.endsWith('/curriculum')) return { data: tree };
    if (path.endsWith('/batches')) return { data: [{ id: 3, name: 'Morning' }] };
    return { data: {} };
  });
}

test('choosing Live shows date, duration, Meet link and batch, and hides free preview', async () => {
  mockApi();
  wrap(<CurriculumTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Add lesson' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText(/free preview/i)).toBeInTheDocument();
  await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'live');
  expect(within(dialog).getByLabelText(/date and time/i)).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/duration/i)).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/meet link/i)).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/^batch/i)).toBeInTheDocument();
  expect(within(dialog).queryByLabelText(/free preview/i)).not.toBeInTheDocument();
});

test('saving a live lesson posts its schedule', async () => {
  mockApi();
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Add lesson' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/lesson title/i), 'Live: factorisation');
  await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'live');
  await userEvent.type(within(dialog).getByLabelText(/date and time/i), '2099-06-15T18:00');
  await userEvent.selectOptions(await within(dialog).findByLabelText(/^batch/i), '3');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(post).toHaveBeenCalled());
  const [path, body] = post.mock.calls[0];
  expect(path).toBe('/teacher/modules/10/contents');
  expect(body).toEqual({
    title: 'Live: factorisation', type: 'live', startsAt: new Date('2099-06-15T18:00').toISOString(), durationMin: 60, meetLink: null, batchId: 3,
  });
});

test('a live lesson row shows its stage and adds a recording', async () => {
  mockApi([liveLesson]);
  const put = vi.spyOn(client.api, 'put').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  expect(await screen.findByText('Upcoming')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Add recording' }));
  const dialog = await screen.findByRole('dialog');
  const source = within(dialog).getByLabelText(/video source/i);
  expect(within(source).getAllByRole('option').map((o) => o.value)).toEqual(expect.arrayContaining(['upload', 'youtube', 'vimeo', 'bunny']));
  await userEvent.selectOptions(source, 'youtube');
  await userEvent.type(within(dialog).getByLabelText(/video link/i), 'https://youtu.be/abcdefgh123');
  await userEvent.tab();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/teacher/contents/50/recording', { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' }));
});

test('a recorded live lesson offers to remove the recording', async () => {
  mockApi([{ ...liveLesson, live: { ...liveLesson.live, stage: 'recorded' }, recording: { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' } }]);
  const del = vi.spyOn(client.api, 'del').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  expect(await screen.findByText('Recorded')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove recording' }));
  await waitFor(() => expect(del).toHaveBeenCalledWith('/teacher/contents/50/recording', undefined));
});
