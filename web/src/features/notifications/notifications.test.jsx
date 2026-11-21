import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../../api/client';
import NotificationsPage from './NotificationsPage';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

const now = new Date().toISOString();
const old = new Date(Date.now() - 10 * 86400000).toISOString();
const rows = [
  { id: 1, title: 'Add the Meet link', message: 'Test starts at 12:00', link: '/teacher/live-classes', isRead: false, createdAt: now },
  { id: 2, title: 'New demo request', message: 'From Yash', link: null, isRead: true, createdAt: old },
];

function mockApi() {
  vi.spyOn(client.api, 'get').mockImplementation(async (_p, params) => (
    params?.limit === 1 ? { data: [rows[0]], pagination: { total: 1 } } : { data: rows, pagination: { page: 1, totalPages: 1, total: 2 } }
  ));
  return vi.spyOn(client.api, 'post').mockResolvedValue({ data: {} });
}

test('groups notifications by day and shows the unread count on the tab', async () => {
  mockApi();
  wrap(<NotificationsPage />);
  expect(await screen.findByText('Add the Meet link')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Earlier' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /^Unread\s*1$/ })).toBeInTheDocument();
});

test('an unread row can be marked as read without leaving the page', async () => {
  const post = mockApi();
  wrap(<NotificationsPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as read: Add the Meet link' }));
  expect(post).toHaveBeenCalledWith('/notifications/1/read');
});
