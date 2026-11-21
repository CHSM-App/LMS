import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../../../api/client';
import { StudentAttendanceCalendar } from './StudentAttendanceCalendar';

afterEach(() => vi.restoreAllMocks());

const month = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

test('shows both courses of one student on the same day, with per-course totals; month arrows refetch', async () => {
  const m = month(new Date());
  const get = vi.spyOn(client.api, 'get').mockImplementation(async (_path, params) => ({
    data: {
      student: { publicId: 'p1', name: 'Asha' },
      month: params.month,
      courses: [{ id: 1, title: 'Maths' }, { id: 2, title: 'Science' }],
      days: params.month === m ? [{
        date: `${m}-10`,
        classes: [
          { liveClassId: 1, course: { id: 1, title: 'Maths' }, topic: 'A1', time: '10:30', present: true },
          { liveClassId: 2, course: { id: 2, title: 'Science' }, topic: 'B1', time: '16:30', present: false },
        ],
      }] : [],
    },
  }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentAttendanceCalendar student={{ publicId: 'p1', name: 'Asha' }} onClose={() => {}} />
    </QueryClientProvider>,
  );
  const grid = await screen.findByRole('grid');
  const cell = within(grid).getByText('10', { selector: '.attcal__day' }).closest('[role="gridcell"]');
  expect(within(cell).getByText(/Maths/)).toBeInTheDocument();
  expect(within(cell).getByText(/Science/)).toBeInTheDocument();
  expect(within(cell).getByText(/Present/)).toBeInTheDocument();
  expect(within(cell).getByText(/Absent/)).toBeInTheDocument();
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['Maths: 100% (1/1)', 'Science: 0% (0/1)']);

  await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(await screen.findByText('No classes with attendance this month.')).toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(2);
});
