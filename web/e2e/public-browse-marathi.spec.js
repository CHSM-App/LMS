import { test, expect } from '@playwright/test';
import { hook, reset } from './helpers';

// Phase 8 manual run: browse logged out, search in Marathi, see both demo videos and the curriculum titles.
test('a visitor searches in Marathi, opens the course and sees both demo videos without logging in', async ({ page, request }) => {
  await reset(request);
  const w = await hook(request, 'POST', '/course', { title: 'इयत्ता दहावी गणित' });

  await page.goto('/');
  const search = page.getByRole('searchbox').or(page.getByLabel(/Search/i)).first();
  await search.fill('गणित');
  await expect(page.getByText('इयत्ता दहावी गणित').first()).toBeVisible();
  await search.fill('nothing-matches-this');
  await expect(page.getByText('इयत्ता दहावी गणित')).toHaveCount(0);
  await search.fill('गणित');
  await page.getByText('इयत्ता दहावी गणित').first().click();

  await expect(page).toHaveURL(new RegExp(`/courses/${w.slug}$`));
  await expect(page.getByRole('heading', { name: 'इयत्ता दहावी गणित' })).toBeVisible();
  await expect(page.getByText('Demo video 1')).toBeVisible();
  await expect(page.getByText('Demo video 2')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Book a free live demo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enroll now' })).toBeVisible();
});
