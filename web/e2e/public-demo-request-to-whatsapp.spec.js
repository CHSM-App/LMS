import { test, expect } from '@playwright/test';
import { enterOtp, hook, istLocal, login, otpFor, reset } from './helpers';

test('a visitor books a live demo; the teacher schedules it and the Meet link goes out on WhatsApp', async ({ page, request }) => {
  await reset(request);
  const { slug, teacher } = await hook(request, 'POST', '/course');
  const visitor = '+919822200002';

  await page.goto(`/courses/${slug}`);
  await page.getByRole('button', { name: 'Book a free live demo' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel(/^Name/).fill('Asha Pawar');
  await form.getByLabel('Mobile number').fill('9822200002');
  await form.getByLabel('Education').fill('10th');
  await form.getByLabel(/I agree to the/).check();
  await expect(form.getByLabel(/class updates and Meet links on WhatsApp/)).toBeChecked();
  await form.getByRole('button', { name: 'Verify mobile number' }).click();
  await enterOtp(page, await otpFor(request, visitor, 'demo_request'));
  await form.getByRole('button', { name: 'Send demo request' }).click();
  await expect(page.getByText(/Request sent\. .* will message you on WhatsApp/)).toBeVisible();

  // Teacher schedules and sends the WhatsApp message.
  await page.context().clearCookies();
  await login(page, request, teacher.mobile);
  await page.getByRole('link', { name: 'Requests' }).click();
  const row = page.getByRole('row', { name: /Asha Pawar/ });
  await row.getByRole('button', { name: 'Schedule' }).click();
  await page.getByRole('dialog').getByLabel('Date and time').fill(istLocal(2, 17));
  await page.getByRole('dialog').getByRole('button', { name: 'Save schedule' }).click();
  await expect(row.getByText('Scheduled')).toBeVisible();
  await row.getByRole('button', { name: 'Send on WhatsApp' }).click();
  await expect(row.getByText('Sent ✓')).toBeVisible();

  const sent = await hook(request, 'GET', '/whatsapp');
  const msg = sent.find((m) => m.mobile === visitor);
  expect(msg, 'WhatsApp message to the visitor').toBeTruthy();
  expect(msg.text).toMatch(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
  expect(msg.template).toBe('demo_scheduled');
});
