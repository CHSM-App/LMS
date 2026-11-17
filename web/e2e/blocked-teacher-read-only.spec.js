import { test, expect } from '@playwright/test';
import { ADMIN_MOBILE, hook, local10, login, otpFor, reset } from './helpers';

test('when the admin blocks a teacher, students keep read-only access to completed lessons and the teacher is locked out', async ({ page, request }) => {
  await reset(request);
  const w = await hook(request, 'POST', '/world');

  // Student completes the first lesson.
  await login(page, request, w.student.mobile);
  await page.getByRole('link', { name: 'Open course' }).first().click();
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page.getByText('Completed').first()).toBeVisible();
  await page.context().clearCookies();

  // Admin blocks the teacher.
  await login(page, request, ADMIN_MOBILE);
  await page.getByRole('link', { name: 'Teachers', exact: true }).click();
  await page.getByRole('row', { name: new RegExp(w.teacher.name) }).getByRole('button', { name: 'Block' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Fee complaints from parents');
  await page.getByRole('dialog').getByRole('button', { name: 'Block teacher' }).click();
  await expect(page.getByText(`${w.teacher.name} is blocked`)).toBeVisible();
  await page.context().clearCookies();

  // Student: read-only.
  await login(page, request, w.student.mobile);
  await expect(page.getByText("Your teacher's account is inactive. You can still open lessons you completed.").first()).toBeVisible();
  await page.getByRole('link', { name: 'Open course' }).first().click();
  await expect(page.getByText("Your teacher's account is inactive.", { exact: false }).first()).toBeVisible();
  const lessons = page.getByRole('navigation', { name: 'Lessons' }).getByRole('button');
  await expect(lessons.first()).toBeEnabled();
  await expect(lessons.nth(1)).toBeDisabled();
  await page.context().clearCookies();

  // Teacher can't log in.
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill(local10(w.teacher.mobile));
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const blockedAtSend = page.getByText('Your account is blocked. Contact support.');
  if (!(await blockedAtSend.isVisible().catch(() => false))) {
    const code = await otpFor(request, w.teacher.mobile, 'login').catch(() => null);
    if (code) {
      for (let i = 0; i < 6; i += 1) await page.getByLabel(`Digit ${i + 1}`, { exact: true }).fill(code[i]);
      await page.getByRole('button', { name: 'Verify and log in' }).click();
    }
  }
  await expect(page.getByText('Your account is blocked. Contact support.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
