import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { hook, login, reset } from './helpers';

// exceljs is an API dependency; borrow it to write the upload file.
const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../api/package.json'));
const ExcelJS = require('exceljs');

const HEADERS = ['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'difficulty', 'marks', 'negative_marks', 'explanation'];

async function workbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  ws.addRow(HEADERS);
  const level = (i) => (i < 8 ? 'easy' : i < 14 ? 'medium' : 'hard');
  for (let i = 0; i < 18; i += 1) ws.addRow(['mcq', `What is ${i} + ${i}?`, String(i * 2), String(i * 2 + 1), '', '', '', 'A', level(i), 1, 0, '']);
  ws.addRow(['essay', 'Write about your village.', '', '', '', '', '', '', 'easy', 1, 0, '']); // bad type
  ws.addRow(['mcq', 'Pick one', '1', '2', '', '', '', 'Z', 'easy', 1, 0, '']); // bad correct letter
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildExam(page, courseId, { title, category, weightage, easy, medium = 0 }) {
  await page.goto(`/teacher/exams/new?course=${courseId}`);
  await page.getByLabel(/^Exam title/).fill(title);
  await page.getByLabel('Algebra › Linear equations').check();
  await page.getByLabel(/^Easy/).fill(String(easy));
  await page.getByLabel(/^Medium/).fill(String(medium));
  await page.getByLabel(/^Category/).selectOption(category);
  await page.getByLabel(/^Weightage/).fill(String(weightage));
  await page.getByLabel(/^Time limit/).fill('20');
  await page.getByLabel(/^Passing/).fill('40');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Exam saved').first()).toBeVisible();
}

test('Excel import with bad rows, then UT1 / UT2 / Final with random selection; validation blocks a bad mix and wrong weightages', async ({ page, request }) => {
  await reset(request);
  const t = await hook(request, 'POST', '/teacher-course');
  await login(page, request, t.mobile);

  // 1. Import 20 rows: 18 valid, 2 with problems.
  await page.getByRole('link', { name: 'Question bank' }).click();
  await page.getByLabel(/^Courses/).selectOption({ index: 1 });
  await page.getByLabel(/^Module/).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Import from Excel' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(/Excel file/).setInputFiles({ name: 'questions.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await workbook() });
  await dlg.getByRole('button', { name: 'Import questions' }).click();
  await expect(dlg.getByText('18 questions imported. 2 rows need fixing.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Download error report' }).or(dlg.getByRole('link', { name: 'Download error report' }))).toBeVisible();
  await expect(dlg.getByRole('row')).toHaveCount(3); // header + 2 problem rows

  // 2. UT1 asks for more easy questions than exist → blocked; fixed → published.
  await buildExam(page, t.courseId, { title: 'Unit Test 1', category: 'unit_test_1', weightage: 25, easy: 20 });
  await expect(page.getByText("Module 'Algebra › Linear equations' has 8 easy questions, exam needs 20").or(page.getByText(/has 8 easy questions, exam needs 20/))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish exam' })).toBeDisabled();
  await page.getByLabel(/^Easy/).fill('5');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('button', { name: 'Publish exam' })).toBeEnabled();
  await page.getByRole('button', { name: 'Publish exam' }).click();
  await expect(page.getByText(/Exam published/).first()).toBeVisible();

  // 3. UT2.
  await buildExam(page, t.courseId, { title: 'Unit Test 2', category: 'unit_test_2', weightage: 25, easy: 3, medium: 2 });
  await page.getByRole('button', { name: 'Publish exam' }).click();
  await expect(page.getByText(/Exam published/).first()).toBeVisible();

  // 4. Final with weightages totalling 90% → blocked; 50% → published.
  await buildExam(page, t.courseId, { title: 'Final Exam', category: 'final', weightage: 40, easy: 4, medium: 4 });
  await expect(page.getByText('Weightages must total 100% (now 90%)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish exam' })).toBeDisabled();
  await page.getByLabel(/^Weightage/).fill('50');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Publish exam' }).click();
  await expect(page.getByText(/Exam published/).first()).toBeVisible();

  await page.goto('/teacher/exams');
  await page.getByLabel(/^Courses/).selectOption({ index: 1 });
  for (const name of ['Unit Test 1', 'Unit Test 2', 'Final Exam']) await expect(page.getByRole('cell', { name, exact: true }).or(page.getByText(name, { exact: true })).first()).toBeVisible();
});
