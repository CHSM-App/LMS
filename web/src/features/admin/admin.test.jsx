import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components';
import { AuthContext } from '../../app/AuthProvider';
import * as client from '../../api/client';
import TeachersPage from './TeachersPage';
import { SubscriptionForm } from './SubscriptionForm';
import { NotificationBell } from '../../app/layouts/NotificationBell';
import { planEndDate } from '../../utils/plans';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ user: { role: 'admin', name: 'Admin' }, loading: false }}>
        <ToastProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const teacherRow = { publicId: 'p1', name: 'Asha Kulkarni', mobile: '+919876500001', subject: 'Maths', status: 'approved', joinedAt: '2026-01-01T00:00:00Z', studentCount: 4 };

test('Block needs a reason, then the row shows Blocked', async () => {
  let blocked = false;
  vi.spyOn(client.api, 'get').mockImplementation(async () => ({ success: true, data: [{ ...teacherRow, status: blocked ? 'blocked' : 'approved' }], pagination: { page: 1, limit: 20, total: 1 } }));
  const post = vi.spyOn(client.api, 'post').mockImplementation(async () => {
    blocked = true;
    return { success: true, data: { status: 'blocked' } };
  });
  wrap(<TeachersPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Block' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Block teacher' }));
  expect(within(dialog).getByText('Write at least 5 characters')).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  await userEvent.type(within(dialog).getByLabelText(/reason/i), 'Repeated complaints');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Block teacher' }));
  expect(post).toHaveBeenCalledWith('/admin/teachers/p1/block', { reason: 'Repeated complaints' });
  await waitFor(() => expect(within(screen.getByRole('table')).getByText(/Blocked/)).toBeInTheDocument());
  expect(within(screen.getByRole('table')).getByRole('button', { name: 'Activate' })).toBeInTheDocument();
});

test('plan end date mirrors the API rule', () => {
  expect(planEndDate('monthly', '2026-01-15')).toBe('2026-02-14');
  expect(planEndDate('yearly', '2026-01-15')).toBe('2027-01-14');
  expect(planEndDate('monthly', '2026-01-31')).toBe('2026-02-28');
  expect(planEndDate('custom', '2026-01-15')).toBe('');
});

test('subscription form fills the end date for a plan and checks custom dates', async () => {
  const onSubmit = vi.fn();
  wrap(<SubscriptionForm teachers={[{ publicId: 'p1', name: 'Asha' }]} onSubmit={onSubmit} onCancel={() => {}} />);
  await userEvent.selectOptions(screen.getByLabelText(/teacher/i), 'p1');
  await userEvent.selectOptions(screen.getByLabelText(/plan/i), 'quarterly');
  await userEvent.clear(screen.getByLabelText(/start date/i));
  await userEvent.type(screen.getByLabelText(/start date/i), '2026-01-01');
  expect(screen.getByText(/ends on 2026-03-31/i)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/plan/i), 'custom');
  await userEvent.type(screen.getByLabelText(/end date/i), '2025-12-01');
  await userEvent.click(screen.getByRole('button', { name: /save subscription/i }));
  expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('notification bell shows the unread count', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 1, total: 3 } });
  wrap(<NotificationBell />);
  expect(await screen.findByText('3')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
});
