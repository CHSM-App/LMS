import { test, expect } from '@playwright/test';
import { ADMIN_MOBILE, currentOtp, enterOtp, hook, login, logout, otpFor, reset } from './helpers';

const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const shift = (days) => new Date(Date.now() + 330 * 60000 + days * 86400000).toISOString().slice(0, 10);

async function apply(page, request, name, digits) {
  await page.goto('/become-teacher');
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel('Mobile number').fill(digits);
  await page.getByLabel('Course you teach').fill('Class 8 English');
  await page.getByLabel(/^Subject/).fill('English');
  await page.getByLabel('Experience in years').fill('3');
  await page.getByLabel(/I agree to the/).check();
  const previous = await currentOtp(request, `+91${digits}`, 'teacher_register');
  await page.getByRole('button', { name: 'Verify mobile number' }).click();
  await enterOtp(page, await otpFor(request, `+91${digits}`, 'teacher_register', previous));
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
}

// Phase 3 manual run: reject → reapply works.
test('a rejected teacher sees the reason and can apply again', async ({ page, request }) => {
  await reset(request);
  await apply(page, request, 'Neha Sawant', '9844400004');

  await login(page, request, ADMIN_MOBILE);
  await page.getByRole('link', { name: 'Teacher requests' }).first().click();
  await page.getByRole('row', { name: /Neha Sawant/ }).getByRole('button', { name: 'Reject' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Please upload your B.Ed certificate');
  await page.getByRole('dialog').getByRole('button', { name: /Reject/ }).click();
  await expect(page.getByText('Request rejected')).toBeVisible();
  await logout(page);

  await login(page, request, '+919844400004', { expectSuccess: false });
  await expect(page.getByText(/Please upload your B\.Ed certificate/)).toBeVisible();
  await page.getByRole('link', { name: 'Apply again' }).click();
  await apply(page, request, 'Neha Sawant', '9844400004');
  await login(page, request, '+919844400004', { expectSuccess: false });
  await expect(page.getByText('Your request is under review')).toBeVisible();
});

// Phase 4 manual run: block a logged-in teacher (other browser) → their session ends; subscriptions add / edit /
// expire; the audit log shows every action.
test('blocking ends a live teacher session; subscriptions are added, changed and expire; all of it is audited', async ({ browser, page, request }) => {
  await reset(request);
  const t = await hook(request, 'POST', '/teacher');

  // The teacher is working in another browser.
  const teacherCtx = await browser.newContext();
  const teacherPage = await teacherCtx.newPage();
  await login(teacherPage, request, t.mobile);
  await expect(teacherPage).toHaveURL(/\/teacher$/);

  // Admin: change the subscription (the hook gave one from 2020 to 2099), then add an expired one for history.
  await login(page, request, ADMIN_MOBILE);
  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  const row = page.getByRole('row', { name: new RegExp(t.name) }).first();
  await row.getByRole('button', { name: /Edit/ }).click();
  const edit = page.getByRole('dialog');
  await edit.getByLabel(/^Plan/).selectOption('custom');
  await edit.getByLabel(/^Start date/).fill(shift(-40));
  await edit.getByLabel(/^End date/).fill(shift(-1));
  await edit.getByRole('button', { name: 'Save subscription' }).click();
  await expect(page.getByText('Subscription saved')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(t.name) }).first().getByText('Expired')).toBeVisible();

  await page.getByRole('button', { name: 'Add subscription' }).click();
  const add = page.getByRole('dialog');
  await add.getByLabel(/^Teacher/).selectOption({ label: t.name });
  await add.getByLabel(/^Plan/).selectOption('custom');
  await add.getByLabel(/^Start date/).fill(today());
  await add.getByLabel(/^End date/).fill(shift(-2));
  await add.getByRole('button', { name: 'Save subscription' }).click();
  await expect(add.getByText('End date must be on or after start date')).toBeVisible();
  await add.getByLabel(/^End date/).fill(shift(30));
  await add.getByRole('button', { name: 'Save subscription' }).click();
  await expect(page.getByText('Subscription saved')).toBeVisible();

  // Block the teacher while they are logged in elsewhere.
  await page.getByRole('link', { name: 'Teachers', exact: true }).click();
  await page.getByRole('row', { name: new RegExp(t.name) }).getByRole('button', { name: 'Block' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Complaints from parents');
  await page.getByRole('dialog').getByRole('button', { name: 'Block teacher' }).click();
  await expect(page.getByText(`${t.name} is blocked`)).toBeVisible();

  await teacherPage.getByRole('link', { name: 'Courses', exact: true }).click();
  await expect(teacherPage).toHaveURL(/\/login/);
  await expect(teacherPage.getByText('Your account is blocked. Contact support.')).toBeVisible();
  await teacherCtx.close();

  // Audit log lists every action from this run.
  await page.getByRole('link', { name: 'Audit log' }).click();
  for (const action of ['Blocked teacher', 'Added subscription', 'Changed subscription']) {
    await expect(page.getByRole('cell', { name: action }).first(), action).toBeVisible();
  }
});
