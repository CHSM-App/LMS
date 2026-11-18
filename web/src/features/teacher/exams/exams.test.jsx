import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components';
import * as client from '../../../api/client';
import { QuestionForm } from './QuestionForm';
import { ImportPanel } from './ImportPanel';
import ExamBuilderPage from './ExamBuilderPage';

function wrap(ui, path = '/', route = '/') {
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

test('question form fields change with the question type', async () => {
  const onSave = vi.fn();
  wrap(<QuestionForm onSave={onSave} onCancel={() => {}} />);
  expect(screen.getAllByLabelText(/^option /i).length).toBeGreaterThanOrEqual(2);
  await userEvent.selectOptions(screen.getByLabelText(/question type/i), 'fill_blank');
  expect(screen.queryByLabelText(/^option /i)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/accepted answers/i)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/question type/i), 'true_false');
  expect(screen.getByRole('radio', { name: 'True' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'False' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/^question\s*\*?$/i), 'The Earth is round');
  await userEvent.click(screen.getByRole('radio', { name: 'True' }));
  await userEvent.click(screen.getByRole('button', { name: /save question/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    type: 'true_false', text: 'The Earth is round',
    options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
  }));
});

test('question form uploads a solution image and sends its key; Remove clears it', async () => {
  const form = vi.spyOn(client.api, 'form').mockResolvedValue({ data: { key: 'solution/abc.png', url: '/api/v1/files/solution/abc.png?exp=1&sig=a' } });
  const onSave = vi.fn();
  wrap(<QuestionForm onSave={onSave} onCancel={() => {}} />);
  await userEvent.selectOptions(screen.getByLabelText(/question type/i), 'fill_blank');
  await userEvent.type(screen.getByLabelText(/^question\s*\*?$/i), '12 x 12 = ?');
  await userEvent.type(screen.getByLabelText(/accepted answers/i), '144');
  const file = new File(['png'], 'working.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText(/solution image/i), file);
  expect(form).toHaveBeenCalledWith('/uploads', expect.any(FormData));
  expect(form.mock.calls[0][1].get('kind')).toBe('solution');
  expect(await screen.findByRole('img', { name: /solution image/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /save question/i }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ explanationImageKey: 'solution/abc.png' }));
  await userEvent.click(screen.getByRole('button', { name: /remove image/i }));
  expect(screen.queryByRole('img', { name: /solution image/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /save question/i }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ explanationImageKey: null }));
});

test('import shows the per-row error table and a download link', async () => {
  vi.spyOn(client.api, 'form').mockResolvedValue({
    data: { imported: 3, errors: [{ row: 4, field: 'correct', message: 'MCQ needs exactly one correct option' }], errorFileUrl: '/api/v1/files/import_errors/x.xlsx?exp=1&sig=a' },
  });
  wrap(<ImportPanel moduleId={5} onDone={() => {}} />);
  const file = new File(['x'], 'q.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await userEvent.upload(screen.getByLabelText(/excel file/i), file);
  await userEvent.click(screen.getByRole('button', { name: /import questions/i }));
  expect(await screen.findByText('3 questions imported. 1 row needs fixing.')).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(within(table).getByText('MCQ needs exactly one correct option')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /download error report/i })).toHaveAttribute('href', '/api/v1/files/import_errors/x.xlsx?exp=1&sig=a');
});

const exam = {
  id: 9, courseId: 3, title: 'Unit Test 1', scope: 'module', mode: 'mock', selection: 'random', category: 'unit_test_1', weightage: 20,
  moduleIds: [10], randomMix: [{ moduleId: 10, easy: 2, medium: 0, hard: 5 }], questionIds: [], batchIds: [], negativeMarking: false,
  timeLimitMin: 30, passingPct: 40, shuffleQuestions: true, shuffleOptions: true, attemptLimit: 1, startsAt: null, endsAt: null, status: 'draft', totalMarks: null,
};

test('exam builder lists problems and keeps Publish disabled until fixed', async () => {
  vi.spyOn(client.api, 'get').mockImplementation(async (path) => {
    if (path === '/teacher/exams/9') return { data: exam };
    if (path.endsWith('/curriculum')) return { data: { subjects: [{ id: 1, name: 'Algebra', modules: [{ id: 10, name: 'Linear equations', contents: [] }] }] } };
    if (path.endsWith('/batches')) return { data: [] };
    if (path.endsWith('/question-counts')) return { data: { easy: 4, medium: 2, hard: 1 } };
    return { data: [] };
  });
  vi.spyOn(client.api, 'post').mockImplementation(async (path) => {
    if (path.endsWith('/validate')) return { data: { ok: false, problems: ["Module 'Linear equations' has 1 hard questions, exam needs 5"] } };
    return { data: {} };
  });
  wrap(<ExamBuilderPage />, '/teacher/exams/9', '/teacher/exams/:examId');
  const problems = await screen.findByRole('alert');
  expect(within(problems).getByText("Module 'Linear equations' has 1 hard questions, exam needs 5")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish exam' })).toBeDisabled());
  expect(screen.getByText(/available: 4 easy, 2 medium, 1 hard/i)).toBeInTheDocument();
});
