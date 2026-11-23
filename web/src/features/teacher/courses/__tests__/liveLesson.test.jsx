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

test('a live lesson can be saved without a date; only the title is sent', async () => {
  mockApi();
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Add lesson' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/lesson title/i), 'Algebra');
  await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'live');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/teacher/modules/10/contents', { title: 'Algebra', type: 'live' }));
});

test('a batch without a date asks for the date', async () => {
  mockApi();
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Add lesson' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/lesson title/i), 'Algebra');
  await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'live');
  await userEvent.selectOptions(await within(dialog).findByLabelText(/^batch/i), '3');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choose a date and time for this batch');
  expect(post).not.toHaveBeenCalled();
});

const twoSessions = {
  ...liveLesson,
  live: {
    ...liveLesson.live,
    slotId: 'aaaaaaaa-0000-0000-0000-000000000001',
    sessions: [
      { contentId: 50, liveClassId: 9, startsAt: '2099-06-15T12:30:00.000Z', durationMin: 60, batch: { id: 3, name: 'Morning' }, stage: 'recorded', recording: { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' } },
      { contentId: 51, liveClassId: 10, startsAt: '2099-06-16T12:30:00.000Z', durationMin: 60, batch: { id: 4, name: 'Evening' }, stage: 'upcoming', recording: null },
    ],
  },
};

test('a lesson lists a session per batch, each with its own recording', async () => {
  mockApi([twoSessions]);
  const put = vi.spyOn(client.api, 'put').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  const evening = (await screen.findByText(/Evening/)).closest('li');
  expect(within(evening).getByText('Upcoming')).toBeInTheDocument();
  const morning = screen.getByText(/Morning/).closest('li');
  expect(within(morning).getByRole('button', { name: 'Remove recording' })).toBeInTheDocument();
  await userEvent.click(within(evening).getByRole('button', { name: 'Add recording' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.selectOptions(within(dialog).getByLabelText(/video source/i), 'youtube');
  await userEvent.type(within(dialog).getByLabelText(/video link/i), 'https://youtu.be/abcdefgh123');
  await userEvent.tab();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/teacher/contents/51/recording', { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' }));
});

test('Add batch on a lesson schedules a session for that batch', async () => {
  mockApi([{ ...liveLesson, live: { ...liveLesson.live, slotId: 's1', sessions: [{ contentId: 50, liveClassId: 9, startsAt: liveLesson.live.startsAt, durationMin: 60, batch: { id: 3, name: 'Morning' }, stage: 'upcoming', recording: null }] } }]);
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Add batch' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.selectOptions(await within(dialog).findByLabelText(/^batch/i), '3');
  await userEvent.type(within(dialog).getByLabelText(/date and time/i), '2099-06-16T18:00');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/teacher/contents/50/sessions', {
    batchId: 3, startsAt: new Date('2099-06-16T18:00').toISOString(), durationMin: 60, meetLink: null,
  }));
});

test('deleting a live lesson asks first and names every batch', async () => {
  mockApi([twoSessions]);
  const del = vi.spyOn(client.api, 'del').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  await screen.findByText(/Evening/);
  const lessonRow = screen.getByText('Live: factorisation').closest('li');
  const deletes = within(lessonRow).getAllByRole('button', { name: 'Delete' });
  await userEvent.click(deletes[deletes.length - 1]);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Morning, Evening');
  expect(del).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(del).toHaveBeenCalledWith('/teacher/contents/50', undefined));
});

test('a lesson with no date yet shows Not scheduled yet', async () => {
  mockApi([{ ...liveLesson, live: { slotId: 's1', liveClassId: null, startsAt: null, durationMin: null, batch: null, stage: 'unscheduled', meetLink: null, sessions: [] } }]);
  wrap(<CurriculumTab courseId={7} />);
  expect(await screen.findByText('Not scheduled yet')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add recording' })).not.toBeInTheDocument();
});

test('a recorded live lesson offers to remove the recording', async () => {
  mockApi([{ ...liveLesson, live: { ...liveLesson.live, stage: 'recorded' }, recording: { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' } }]);
  const del = vi.spyOn(client.api, 'del').mockResolvedValue({ data: {} });
  wrap(<CurriculumTab courseId={7} />);
  expect(await screen.findByText('Recorded')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove recording' }));
  await waitFor(() => expect(del).toHaveBeenCalledWith('/teacher/contents/50/recording', undefined));
});

test('a lesson for all batches also offers Add batch', async () => {
  mockApi([{ ...liveLesson, live: { ...liveLesson.live, batch: null } }]);
  wrap(<CurriculumTab courseId={7} />);
  expect(await screen.findByRole('button', { name: 'Add batch' })).toBeInTheDocument();
});
