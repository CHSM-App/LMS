import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import { RequireRole } from './RequireRole';
import LoginPage from '../features/auth/LoginPage';
import * as client from '../api/client';

function withAuth(ui, value) {
  return <AuthContext.Provider value={{ user: null, loading: false, login: vi.fn(), logout: vi.fn(), ...value }}>{ui}</AuthContext.Provider>;
}

afterEach(() => vi.restoreAllMocks());

test('RequireRole sends a teacher away from admin pages to /teacher', () => {
  render(
    withAuth(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RequireRole roles={['admin']}><p>Admin area</p></RequireRole>} />
          <Route path="/teacher" element={<p>Teacher home</p>} />
        </Routes>
      </MemoryRouter>,
      { user: { role: 'teacher' } },
    ),
  );
  expect(screen.getByText('Teacher home')).toBeInTheDocument();
});

test('RequireRole sends a logged-out visitor to /login', () => {
  render(
    withAuth(
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route path="/student" element={<RequireRole roles={['student']}><p>Student</p></RequireRole>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
      {},
    ),
  );
  expect(screen.getByText('Login page')).toBeInTheDocument();
});

test('login shows the OTP step after sending, with a resend countdown', async () => {
  vi.spyOn(client.api, 'post').mockResolvedValue({ success: true, data: { sent: true, resendAfterSec: 30 } });
  render(withAuth(<MemoryRouter><LoginPage /></MemoryRouter>, {}));
  await userEvent.type(screen.getByLabelText(/mobile number/i), '9876543210');
  await userEvent.click(screen.getByRole('button', { name: /send otp/i }));
  await waitFor(() => expect(screen.getByRole('group', { name: /one-time password/i })).toBeInTheDocument());
  expect(screen.getByText(/resend otp in 30s/i)).toBeInTheDocument();
  expect(client.api.post).toHaveBeenCalledWith('/auth/otp/send', { mobile: '9876543210', purpose: 'login' });
});

test('login rejects an invalid mobile before calling the API', async () => {
  const spy = vi.spyOn(client.api, 'post');
  render(withAuth(<MemoryRouter><LoginPage /></MemoryRouter>, {}));
  await userEvent.type(screen.getByLabelText(/mobile number/i), '12345');
  await userEvent.click(screen.getByRole('button', { name: /send otp/i }));
  expect(screen.getByText('Enter a valid 10-digit mobile number')).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalled();
});
