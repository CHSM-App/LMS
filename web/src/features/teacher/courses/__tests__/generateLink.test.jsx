import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { vi } from 'vitest';
import i18n from '../../../../i18n';
import * as client from '../../../../api/client';
import { GenerateLinkButton } from '../GenerateLinkButton';
import { LiveLessonFields, emptyLive } from '../LiveLessonFields';
import { useState } from 'react';

const wrap = (ui) => render(
  <I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider></I18nextProvider>,
);
afterEach(() => vi.restoreAllMocks());

test('Generate link is disabled until the topic and the date are filled', () => {
  wrap(<GenerateLinkButton topic="" startsAt="" onLink={() => {}} />);
  expect(screen.getByRole('button', { name: 'Generate link' })).toBeDisabled();
});

test('Generate link asks the API and hands the link back; nothing is saved by the button', async () => {
  const post = vi.spyOn(client.api, 'post').mockResolvedValue({ data: { meetLink: 'https://meet.google.com/xyz-abcd-efg' } });
  const onLink = vi.fn();
  wrap(<GenerateLinkButton topic="Algebra" startsAt="2099-06-15T18:00" durationMin={45} onLink={onLink} />);
  await userEvent.click(screen.getByRole('button', { name: 'Generate link' }));
  await waitFor(() => expect(onLink).toHaveBeenCalledWith('https://meet.google.com/xyz-abcd-efg'));
  expect(post).toHaveBeenCalledWith('/teacher/live-classes/meet-link/generate', { topic: 'Algebra', startsAt: new Date('2099-06-15T18:00').toISOString(), durationMin: 45 });
});

test('a failure is shown and the field is left alone', async () => {
  vi.spyOn(client.api, 'post').mockRejectedValue(new Error('Automatic Meet links are not set up. Paste a link instead.'));
  const onLink = vi.fn();
  wrap(<GenerateLinkButton topic="Algebra" startsAt="2099-06-15T18:00" onLink={onLink} />);
  await userEvent.click(screen.getByRole('button', { name: 'Generate link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Paste a link instead');
  expect(onLink).not.toHaveBeenCalled();
});

test('in the live lesson form the generated link fills the optional Meet link field', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ data: [] });
  vi.spyOn(client.api, 'post').mockResolvedValue({ data: { meetLink: 'https://meet.google.com/xyz-abcd-efg' } });
  function Host() {
    const [v, setV] = useState({ ...emptyLive(null), startsAt: '2099-06-15T18:00' });
    return <LiveLessonFields courseId={1} topic="Algebra" value={v} onChange={setV} />;
  }
  wrap(<Host />);
  await userEvent.click(screen.getByRole('button', { name: 'Generate link' }));
  await waitFor(() => expect(screen.getByLabelText(/Meet link/)).toHaveValue('https://meet.google.com/xyz-abcd-efg'));
});
