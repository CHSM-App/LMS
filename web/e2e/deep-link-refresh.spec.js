import { test, expect } from '@playwright/test';
import { hook, login, reset } from './helpers';

// Opening or refreshing any route directly (as from a shared link or a notification) must never 404:
// the static server applies the same rules as public/.htaccess and public/web.config.
let w;
test.beforeAll(async ({ request }) => {
  await reset(request);
  w = await hook(request, 'POST', '/world');
});

const publicRoutes = () => ['/', '/courses', `/courses/${w.slug}`, '/login', '/become-teacher', '/register', '/terms', '/privacy', '/account/delete-info', `/enroll/${w.slug}`, '/no/such/page'];

test('public deep links load and survive a refresh', async ({ page }) => {
  for (const route of publicRoutes()) {
    const res = await page.goto(route);
    expect(res.status(), route).toBe(200);
    expect(res.headers()['content-type'], route).toContain('text/html');
    await expect(page.locator('#root'), route).not.toBeEmpty();
    const again = await page.reload();
    expect(again.status(), `${route} after refresh`).toBe(200);
    await expect(page.locator('#root'), `${route} after refresh`).not.toBeEmpty();
  }
});

test('a course link opens the course page directly', async ({ page }) => {
  await page.goto(`/courses/${w.slug}`);
  await expect(page.getByRole('heading', { name: 'Class 10 Maths' })).toBeVisible();
});

test('a signed-in deep link (notification link) works after a refresh', async ({ page, request }) => {
  await login(page, request, w.student.mobile);
  for (const route of ['/student', `/student/courses/${w.courseId}`, '/student/exams', '/student/doubts', '/notifications', '/account']) {
    const res = await page.goto(route);
    expect(res.status(), route).toBe(200);
    await page.reload();
    await expect(page, route).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`));
  }
});

test('a signed-out deep link goes to login, not a 404', async ({ page }) => {
  const res = await page.goto('/student/exams');
  expect(res.status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);
});

test('built assets are served as files, not rewritten', async ({ request, page }) => {
  await page.goto('/');
  const src = await page.locator('script[type="module"]').first().getAttribute('src');
  const res = await request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('javascript');
});
