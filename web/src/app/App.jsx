import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './AuthProvider';
import { RequireRole } from './RequireRole';
import { AppShell } from './layouts/AppShell';
import { PublicLayout } from './layouts/PublicLayout';
import { ToastProvider, Spinner } from '../components';
import { ADMIN_NAV, TEACHER_NAV, STUDENT_NAV } from './nav';

const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const BecomeTeacherPage = lazy(() => import('../features/auth/BecomeTeacherPage'));
const LegalPage = lazy(() => import('../features/public/LegalPage'));
const AccountPage = lazy(() => import('../features/account/AccountPage'));
const TeacherRequestsPage = lazy(() => import('../features/admin/TeacherRequestsPage'));
const ComingSoon = lazy(() => import('./ComingSoon'));
const StyleGuide = lazy(() => import('./StyleGuide'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 } },
});

function Loading() {
  const { t } = useTranslation();
  return <Spinner label={t('common.loading')} />;
}

function RoleShell({ roles, nav }) {
  return (
    <RequireRole roles={roles}>
      <AppShell nav={nav} />
    </RequireRole>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route index element={<ComingSoon title="app.tagline" />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="become-teacher" element={<BecomeTeacherPage />} />
                  <Route path="terms" element={<LegalPage doc="terms" />} />
                  <Route path="privacy" element={<LegalPage doc="privacy" />} />
                  {import.meta.env.DEV && <Route path="_styleguide" element={<StyleGuide />} />}
                </Route>

                <Route path="admin" element={<RoleShell roles={['admin']} nav={ADMIN_NAV} />}>
                  <Route index element={<Navigate to="teacher-requests" replace />} />
                  <Route path="teacher-requests" element={<TeacherRequestsPage />} />
                </Route>

                <Route path="teacher" element={<RoleShell roles={['teacher']} nav={TEACHER_NAV} />}>
                  <Route index element={<ComingSoon title="common.dashboard" />} />
                </Route>

                <Route path="student" element={<RoleShell roles={['student']} nav={STUDENT_NAV} />}>
                  <Route index element={<ComingSoon title="common.dashboard" />} />
                </Route>

                <Route element={<RoleShell roles={['admin', 'teacher', 'student']} nav={[]} />}>
                  <Route path="account" element={<AccountPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
