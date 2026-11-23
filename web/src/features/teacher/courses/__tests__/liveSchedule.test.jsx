import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../../components';
import * as client from '../../../../api/client';
import { BatchesTab } from '../BatchesTab';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>);
}
afterEach(() => vi.restoreAllMocks());

const schedule = [
  { slotId: 's1', contentId: 50, title: 'Algebra', module: { id: 10, name: 'Linear' }, session: null },
  { slotId: 's2', contentId: 60, title: 'Geometry', module: { id: 10, name: 'Linear' }, session: null },
  { slotId: 's3', contentId: 70, title: 'Revision', module: { id: 11, name: 'Exam' }, session: { contentId: 71, startsAt: '2099-07-03T12:30:00.000Z', durationMin: 60, stage: 'upcoming', batch: { id: 4, name: '2027 - Batch A' } } },
];

function mockApi() {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path.endsWith('/live-schedule')) return { data: schedule };
    if (path.endsWith('/batches')) return { data: [{ id: 4, name: '2027 - Batch A', startDate: '2027-06-01', studentCount: 0, status: 'active' }] };
    return { data: {} };
  });
}

async function openSchedule() {
  mockApi();
  wrap(<BatchesTab courseId={7} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Live schedule' }));
  return screen.findByRole('dialog');
}

test('lists every live lesson of the course for the batch', async () => {
  const dialog = await openSchedule();
  expect(await within(dialog).findByText('Algebra')).toBeInTheDocument();
  expect(within(dialog).getByText('Geometry')).toBeInTheDocument();
  expect(within(dialog).getByText('Revision')).toBeInTheDocument();
  expect(within(dialog).getAllByLabelText(/date and time/i)).toHaveLength(2);
});

test('saves only the filled rows in one request', async () => {
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { created: 1, sessions: [] } });
  const dialog = await openSchedule();
  const [first] = await within(dialog).findAllByLabelText(/date and time/i);
  await userEvent.type(first, '2099-07-01T18:00');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/teacher/courses/7/batches/4/live-schedule', {
    items: [{ slotId: 's1', startsAt: new Date('2099-07-01T18:00').toISOString(), durationMin: 60, meetLink: null }],
  }));
});

test('a Meet link typed for a lesson is sent with it', async () => {
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { created: 1, sessions: [] } });
  const dialog = await openSchedule();
  const [first] = await within(dialog).findAllByLabelText(/date and time/i);
  await userEvent.type(first, '2099-07-01T18:00');
  const [link] = within(dialog).getAllByLabelText(/meet link/i);
  await userEvent.type(link, 'https://meet.google.com/abc-defg-hij');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/teacher/courses/7/batches/4/live-schedule', {
    items: [{ slotId: 's1', startsAt: new Date('2099-07-01T18:00').toISOString(), durationMin: 60, meetLink: 'https://meet.google.com/abc-defg-hij' }],
  }));
});

test('a server error is shown and the dialog stays open', async () => {
  vi.spyOn(client.api, 'post').mockRejectedValue(new Error('This batch already has a session of Algebra'));
  const dialog = await openSchedule();
  const [first] = await within(dialog).findAllByLabelText(/date and time/i);
  await userEvent.type(first, '2099-07-01T18:00');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('already has a session');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
