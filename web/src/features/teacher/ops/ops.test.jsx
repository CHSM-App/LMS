import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components';
import * as client from '../../../api/client';
import RequestsPage from './RequestsPage';
import { AttendanceSheet } from './AttendanceSheet';

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

const demo = {
  id: 1, course: { id: 3, title: 'Class 10 Maths' }, name: 'Asha', mobile: '+919811100001', education: '10th', status: 'scheduled',
  scheduledAt: '2099-05-01T04:30:00Z', meetLink: 'https://meet.google.com/abc-defg-hij', whatsappOptIn: true, whatsappSentAt: null, createdAt: '2026-01-01T00:00:00Z',
};
const pendingDemo = { ...demo, id: 2, name: 'Ravi', status: 'pending', scheduledAt: null, meetLink: null };
const enrollment = { id: 7, course: { id: 3, title: 'Class 10 Maths' }, student: { name: 'Meera', mobile: '+919811100002', education: '12th' }, status: 'pending', requestedAt: '2026-01-02T00:00:00Z' };

function mockGets() {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/teacher/demo-requests') return { data: [demo, pendingDemo] };
    if (path === '/teacher/enrollments') return { data: [enrollment] };
    if (path.endsWith('/batches')) return { data: [{ id: 11, name: 'Morning', status: 'active', studentCount: 1, maxStudents: 30 }] };
    return { data: [] };
  });
}

test('schedule dialog needs a date and time', async () => {
  mockGets();
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<RequestsPage />);
  const row = (await screen.findByText('Ravi')).closest('tr');
  await userEvent.click(within(row).getByRole('button', { name: 'Schedule' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
  expect(within(dialog).getByText('Choose the date and time')).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test('Send on WhatsApp shows Sent, or Not sent with Retry and an Open in WhatsApp fallback', async () => {
  mockGets();
  const post = vi.spyOn(client.api, 'post')
    .mockRejectedValueOnce(new client.ApiError(502, 'WhatsApp message not sent. Try again.', 'WHATSAPP_FAILED', { fallbackUrl: 'https://wa.me/919811100001?text=hi' }))
    .mockResolvedValueOnce({ data: { ...demo, whatsappSentAt: '2026-01-01T00:00:00Z' } });
  wrap(<RequestsPage />);
  const row = (await screen.findByText('Asha')).closest('tr');
  await userEvent.click(within(row).getByRole('button', { name: 'Send on WhatsApp' }));
  expect(await within(row).findByText('Not sent')).toBeInTheDocument();
  expect(within(row).getByRole('link', { name: 'Open in WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919811100001?text=hi');
  await userEvent.click(within(row).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(within(row).getByText('Sent ✓')).toBeInTheDocument());
  expect(post).toHaveBeenCalledTimes(2);
});

test('approving an enrollment needs a batch and both dates', async () => {
  mockGets();
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
  wrap(<RequestsPage />);
  await userEvent.click(await screen.findByRole('tab', { name: /enrollment requests/i }));
  const row = (await screen.findByText('Meera')).closest('tr');
  await userEvent.click(within(row).getByRole('button', { name: 'Approve' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.clear(within(dialog).getByLabelText(/end date/i));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approve student' }));
  expect(within(dialog).getByText('Choose a batch')).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  await userEvent.selectOptions(within(dialog).getByLabelText(/batch/i), '11');
  await userEvent.type(within(dialog).getByLabelText(/end date/i), '2026-12-31');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approve student' }));
  expect(post).toHaveBeenCalledWith('/teacher/enrollments/7/approve', expect.objectContaining({ batchId: 11, endDate: '2026-12-31' }));
});

test('attendance sheet: Mark all present then save', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: [{ studentPublicId: 'a', name: 'A', present: null }, { studentPublicId: 'b', name: 'B', present: false }] });
  const put = vi.spyOn(client.api, 'put').mockResolvedValue({ data: [] });
  wrap(<AttendanceSheet liveClassId={5} onDone={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark all present' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
  expect(put).toHaveBeenCalledWith('/teacher/live-classes/5/attendance', { records: [{ studentPublicId: 'a', present: true }, { studentPublicId: 'b', present: true }] });
});
