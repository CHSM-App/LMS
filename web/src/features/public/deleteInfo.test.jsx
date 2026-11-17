import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '../../api/client';
import DeleteInfoPage from './DeleteInfoPage';

// Google Play requires a public web page that explains how to delete an account and what is deleted.
test('account deletion page explains the steps, what is deleted and kept, and how to get help', async () => {
  vi.spyOn(client.api, 'get').mockResolvedValue({ success: true, data: { supportContact: 'help@school.example', policyVersion: '1.0' } });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DeleteInfoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Delete your account' })).toBeInTheDocument();
  expect(screen.getByText(/In the app: open More → Account → Delete account/)).toBeInTheDocument();
  expect(screen.getByText(/On the website: log in, open Account → Delete account/)).toBeInTheDocument();
  expect(screen.getByText(/Name, mobile number, email, photo and profile details are deleted/)).toBeInTheDocument();
  expect(screen.getByText(/Downloaded videos are removed from your phone/)).toBeInTheDocument();
  expect(screen.getByText(/Exam scores and attendance stay with your teacher as "Deleted user"/)).toBeInTheDocument();
  expect(await screen.findByText(/help@school\.example/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
});
