import { test, expect } from '@playwright/test';
import { hook, istLocal, login, reset } from './helpers';

// Phase 7 manual run: approve an enrollment → the student list shows active; schedule a class → WhatsApp goes
// to the batch; take attendance; answer a doubt.
test('teacher approves an enrollment, schedules a class, takes attendance and answers a doubt', async ({ page, request }) => {
  await reset(request);
  const w = await hook(request, 'POST', '/ops-world');
  await login(page, request, w.teacher.mobile);

  // Approve the waiting student.
  await page.getByRole('link', { name: 'Requests' }).click();
  await page.getByRole('tab', { name: 'Enrollment requests' }).click();
  await page.getByRole('row', { name: /Kiran Joshi/ }).getByRole('button', { name: 'Approve' }).click();
  const approve = page.getByRole('dialog');
  await approve.getByLabel(/^Batch/).selectOption({ label: 'Morning' });
  await approve.getByLabel(/^End date/).fill(new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10));
  await approve.getByRole('button', { name: 'Approve student' }).click();
  await expect(page.getByText('Student approved')).toBeVisible();

  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('row', { name: /Kiran Joshi/ }).getByText('Active')).toBeVisible();

  // Schedule a live class for the Morning batch.
  await page.getByRole('link', { name: 'Live classes' }).click();
  await page.getByRole('button', { name: 'Schedule a class' }).click();
  const cls = page.getByRole('dialog');
  await cls.getByLabel(/^Courses/).selectOption({ index: 1 });
  await cls.getByLabel(/^Batch/).selectOption({ label: 'Morning' });
  await cls.getByLabel(/^Topic/).fill('Linear equations revision');
  await cls.getByLabel(/^Date and time/).fill(istLocal(1, 18));
  await cls.getByRole('button', { name: 'Save class' }).click();
  const row = page.getByRole('row', { name: /Linear equations revision/ });
  await expect(row).toBeVisible();
  const sent = await hook(request, 'GET', '/whatsapp');
  expect(sent.some((m) => m.template === 'live_class' && /meet\.google\.com/.test(m.text))).toBe(true);

  // Attendance.
  await row.getByRole('button', { name: 'Attendance' }).click();
  const att = page.getByRole('dialog');
  await att.getByRole('button', { name: 'Mark all present' }).click();
  await att.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved')).toBeVisible();

  // Answer the doubt.
  await page.getByRole('link', { name: 'Doubts' }).click();
  await expect(page.getByText('How do I solve 2x + 3 = 7?')).toBeVisible();
  await page.getByRole('button', { name: 'Reply', exact: true }).first().click();
  await page.getByRole('dialog').getByLabel(/^Your reply/).fill('Subtract 3 from both sides, then divide by 2: x = 2.');
  await page.getByRole('dialog').getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('Reply sent')).toBeVisible();
});
