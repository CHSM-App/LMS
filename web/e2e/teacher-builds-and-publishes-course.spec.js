import { test, expect } from '@playwright/test';
import { hook, login, png, reset } from './helpers';

test('a teacher builds a course (details, thumbnail, 2 demo videos, curriculum) and publishes it', async ({ page, request }) => {
  await reset(request);
  const teacher = await hook(request, 'POST', '/teacher');
  await login(page, request, teacher.mobile);

  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: 'New course' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Course title').fill('Class 9 Algebra Crash Course');
  await dialog.getByLabel(/^Subject/).fill('Maths');
  await dialog.getByLabel('Teaching language').selectOption('mr');
  await dialog.getByLabel('Full description').fill('Linear equations, polynomials and practice tests for Class 9.');
  await dialog.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();

  // Publishing is blocked until the course is complete.
  await page.getByRole('button', { name: 'Publish course' }).click();
  await expect(page.getByText('Finish these before publishing:')).toBeVisible();

  // Thumbnail + two demo videos.
  await page.getByLabel('Upload thumbnail').setInputFiles({ name: 'thumb.png', mimeType: 'image/png', buffer: png() });
  const demo1 = page.getByRole('group', { name: 'Demo video 1' });
  await demo1.getByLabel('Video source').selectOption('youtube');
  await demo1.getByLabel('Video link').fill('https://youtu.be/abcdefgh123');
  await demo1.getByLabel('Video link').blur();
  const demo2 = page.getByRole('group', { name: 'Demo video 2' });
  await demo2.getByLabel('Video source').selectOption('vimeo');
  await demo2.getByLabel('Video link').fill('https://vimeo.com/123456');
  await demo2.getByLabel('Video link').blur();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText(/Saved/).first()).toBeVisible();

  // Curriculum: subject → module → lesson.
  await page.getByRole('tab', { name: 'Curriculum' }).click();
  await page.getByRole('button', { name: 'Add subject' }).click();
  await page.getByRole('dialog').getByLabel(/^Name/).fill('Algebra');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Add module' }).click();
  await page.getByRole('dialog').getByLabel(/^Name/).fill('Linear equations');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Add lesson' }).click();
  const lesson = page.getByRole('dialog');
  await lesson.getByLabel('Lesson title').fill('Solving for x');
  await lesson.getByLabel('Type').selectOption('link');
  await lesson.getByLabel('Web address').fill('https://example.com/solving-for-x');
  await lesson.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Solving for x')).toBeVisible();

  await page.getByRole('button', { name: 'Publish course' }).click();
  await expect(page.getByText('Course published')).toBeVisible();

  // Visible on the public site.
  await page.goto('/courses');
  await page.getByText('Class 9 Algebra Crash Course').first().click();
  await expect(page.getByRole('heading', { name: 'Class 9 Algebra Crash Course' })).toBeVisible();
  await expect(page.getByText('Algebra', { exact: true }).first()).toBeVisible();
});
