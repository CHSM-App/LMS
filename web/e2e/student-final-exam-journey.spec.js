import { test, expect } from '@playwright/test';
import { hook, login, reset } from './helpers';

const answerAll = async (page) => {
  for (const group of await page.getByRole('radiogroup').all()) {
    const q = await group.getAttribute('aria-label');
    const n = Number(q.match(/What is (\d+) \+/)[1]);
    await group.getByLabel(String(n * 2), { exact: true }).check();
  }
};

async function takeAndSubmit(page, name) {
  await page.goto('/student/exams');
  await page.locator('section.card', { has: page.getByRole('heading', { name, exact: true }) }).getByRole('link', { name: 'Start' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await answerAll(page);
  await expect(page.getByText('Saved')).toBeVisible();
  await page.getByRole('button', { name: 'Submit exam' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit now' }).click();
  await expect(page).toHaveURL(/\/result$/);
}

// Phase 9 manual run: UT1 + UT2 unlock the Final; the network drops mid-Final and answers sync when it returns;
// reopening resumes with the timer still running; the server auto-submits at the deadline; weighted final result.
test('UT1 and UT2 unlock the Final; offline answers sync; resume keeps the timer; auto-submit; weighted final', async ({ page, context, request }) => {
  await reset(request);
  const w = await hook(request, 'POST', '/world-exams');
  await login(page, request, w.student.mobile);

  await page.goto('/student/exams');
  await expect(page.getByText('Finish all Unit Tests to unlock the Final Exam.')).toBeVisible();
  await takeAndSubmit(page, 'Unit Test 1');
  await expect(page.getByText('2 / 2 (100%)')).toBeVisible();
  await takeAndSubmit(page, 'Unit Test 2');

  await page.goto('/student/exams');
  await expect(page.getByText('Finish all Unit Tests to unlock the Final Exam.')).toHaveCount(0);
  await page.locator('section.card', { has: page.getByRole('heading', { name: 'Final Exam', exact: true }) }).getByRole('link', { name: 'Start' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText(/^(10:00|9:5\d)$/);

  // The network drops: the answer is kept and synced when the connection returns.
  const groups = await page.getByRole('radiogroup').all();
  await context.setOffline(true);
  const q1 = await groups[0].getAttribute('aria-label');
  await groups[0].getByLabel(String(Number(q1.match(/What is (\d+) \+/)[1]) * 2), { exact: true }).check();
  await expect(page.getByText('Offline — answers will sync')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 15_000 });

  // Reopen the exam: same attempt, timer keeps running from the server deadline.
  await page.waitForTimeout(2000);
  await page.reload();
  await expect(timer).toHaveText(/^9:[0-5]\d$/);
  await expect(groups[0].getByRole('radio', { checked: true })).toHaveCount(1);

  // Time runs out on the server (the student never submits): the job auto-submits with the saved answer.
  await hook(request, 'POST', '/clock', { ms: String(11 * 60 * 1000) });
  await hook(request, 'POST', '/jobs/exam-auto-submit');
  await page.goto('/student/exams');
  const finalCard = page.locator('section.card', { has: page.getByRole('heading', { name: 'Final Exam', exact: true }) });
  await finalCard.getByRole('link', { name: 'View result' }).click();
  await expect(page.getByText('Submitted automatically when time ran out')).toBeVisible();
  await expect(page.getByText('1 / 2 (50%)')).toBeVisible();

  // Weighted final: UT1 100% × 25 + UT2 100% × 25 + Final 50% × 50 = 75%.
  await page.goto(`/student/courses/${w.courseId}/final-result`);
  await expect(page.getByText('75%', { exact: true })).toBeVisible();
});
