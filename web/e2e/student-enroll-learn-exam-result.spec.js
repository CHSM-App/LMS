import { test, expect } from '@playwright/test';
import { enterOtp, hook, login, otpFor, reset } from './helpers';

test('a new student registers and enrolls; the teacher approves; a student learns, takes the exam and sees the result', async ({ page, request }) => {
  await reset(request);
  const w = await hook(request, 'POST', '/world');
  const newcomer = '+919833300003';

  // 1. Visitor → Enroll now → registers (OTP) → sends the enrollment request.
  await page.goto(`/courses/${w.slug}`);
  await page.getByRole('link', { name: 'Enroll now' }).click();
  await expect(page.getByRole('heading', { name: 'Create your student account' })).toBeVisible();
  await page.getByLabel(/^Name/).fill('Kiran Joshi');
  await page.getByLabel('Mobile number').fill('9833300003');
  await page.getByLabel(/^Education/).fill('10th');
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Verify mobile number' }).click();
  await enterOtp(page, await otpFor(request, newcomer, 'student_register'));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Send enrollment request' }).click();
  await expect(page.getByText(`Request sent. You'll be notified when ${w.teacher.name} approves it.`)).toBeVisible();

  // 2. Teacher approves into the Morning batch.
  await page.context().clearCookies();
  await login(page, request, w.teacher.mobile);
  await page.getByRole('link', { name: 'Requests' }).click();
  await page.getByRole('tab', { name: 'Enrollment requests' }).click();
  await page.getByRole('row', { name: /Kiran Joshi/ }).getByRole('button', { name: 'Approve' }).click();
  const approve = page.getByRole('dialog');
  await approve.getByLabel(/^Batch/).selectOption({ label: 'Morning' });
  const end = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  await approve.getByLabel(/^End date/).fill(end);
  await approve.getByRole('button', { name: 'Approve student' }).click();
  await expect(page.getByText('Student approved')).toBeVisible();

  // 3. The new student now sees the course.
  await page.context().clearCookies();
  await login(page, request, newcomer);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole('heading', { name: 'Class 10 Maths' }).first()).toBeVisible();

  // 4. Enrolled student: learn → exam → result.
  await page.context().clearCookies();
  await login(page, request, w.student.mobile);
  await page.getByRole('link', { name: 'Open course' }).first().click();
  await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page.getByRole('progressbar').first()).not.toHaveAttribute('aria-valuenow', '0');

  await page.getByRole('link', { name: 'Exams' }).click();
  await page.getByRole('link', { name: 'Start' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^1[45]:\d\d$/);
  for (let n = 1; n <= 4; n += 1) {
    await page.getByRole('radiogroup', { name: `What is ${n} + ${n}?` }).getByLabel(String(n * 2), { exact: true }).check();
  }
  await expect(page.getByText('Saved')).toBeVisible();
  await page.getByRole('button', { name: 'Submit exam' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit now' }).click();

  await expect(page).toHaveURL(/\/student\/attempts\/.+\/result$/);
  await expect(page.getByText('4 / 4 (100%)')).toBeVisible();
  await expect(page.getByText('Answer review')).toBeVisible();
});
