import { test, expect } from '@playwright/test';
import { ADMIN_MOBILE, hook, login, reset } from './helpers';

// Phase 2 Review Focus: long Marathi text and 360 px phones never cause a horizontal page scroll; tables become
// stacked cards; every control reached with Tab shows a visible focus ring.
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('360 px phone in Marathi', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('public pages and the admin teacher table fit without horizontal scroll; table rows stack', async ({ browser, page, request }) => {
    await reset(request);
    const w = await hook(request, 'POST', '/course', { title: 'इयत्ता दहावी गणित — संपूर्ण अभ्यासक्रम, सराव परीक्षा आणि उजळणी वर्ग' });
    await page.addInitScript(() => localStorage.setItem('lang', 'mr'));

    for (const route of ['/', '/courses', `/courses/${w.slug}`, '/login', '/become-teacher']) {
      await page.goto(route);
      await expect(page.locator('#root')).not.toBeEmpty();
      expect(await noHorizontalScroll(page), route).toBe(true);
      if (route.startsWith('/courses/')) await expect(page.getByText(/इयत्ता दहावी गणित/).first()).toBeVisible();
    }

    // Admin logs in (English labels), then switches the UI to Marathi.
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const admin = await ctx.newPage();
    await login(admin, request, ADMIN_MOBILE);
    await admin.evaluate(() => localStorage.setItem('lang', 'mr'));
    await admin.goto('/admin/teachers');
    const cell = admin.locator('table td[data-label]').first();
    await expect(cell).toBeVisible();
    expect(await cell.evaluate((td) => getComputedStyle(td).display), 'cells stack instead of forming table columns').not.toBe('table-cell');
    expect(await noHorizontalScroll(admin)).toBe(true);
    await ctx.close();
  });
});

test('keyboard only: Tab reaches every control on the login page and each shows a focus ring', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
  const seen = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
      return { name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 40), ring };
    });
    if (info) seen.push(info);
  }
  const names = seen.map((s) => s.name);
  expect(names.some((n) => /Mobile|Send OTP/.test(n)) || seen.length > 3).toBe(true);
  expect(names.join(' | ')).toMatch(/Send OTP/);
  expect(seen.filter((s) => !s.ring), 'controls without a visible focus ring').toEqual([]);
});
