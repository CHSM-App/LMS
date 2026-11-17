import { test, expect } from '@playwright/test';
import { ADMIN_MOBILE, enterOtp, login, logout, otpFor, reset } from './helpers';

test('a teacher applies, the admin accepts, and the teacher can log in', async ({ page, request }) => {
  await reset(request);
  const mobile = '+919811100001';

  // 1. Teacher applies (OTP-verified).
  await page.goto('/become-teacher');
  await page.getByLabel(/^Name/).fill('Ravi Kulkarni');
  await page.getByLabel('Mobile number').fill('9811100001');
  await page.getByLabel('Course you teach').fill('Class 10 Science (SSC)');
  await page.getByLabel(/^Subject/).fill('Science');
  await page.getByLabel('Experience in years').fill('6');
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Verify mobile number' }).click();
  await enterOtp(page, await otpFor(request, mobile, 'teacher_register'));
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();

  // 2. Before approval the teacher can't log in.
  await login(page, request, mobile, { expectSuccess: false });
  await expect(page.getByText('Your request is under review')).toBeVisible();
  await logout(page);

  // 3. Admin accepts.
  await login(page, request, ADMIN_MOBILE);
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole('link', { name: 'Teacher requests' }).first().click();
  await page.getByRole('row', { name: /Ravi Kulkarni/ }).getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Request accepted. Ravi Kulkarni can now log in.')).toBeVisible();
  await logout(page);

  // 4. Teacher logs in and lands on the teacher dashboard.
  await login(page, request, mobile);
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole('heading', { name: /Ravi Kulkarni/ })).toBeVisible();
});
