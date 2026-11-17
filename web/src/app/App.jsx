import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './AuthProvider';
import { RoleShell } from './layouts/RoleShell';
import { PublicLayout } from './layouts/PublicLayout';
import { ToastProvider, Spinner } from '../components';

const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const BecomeTeacherPage = lazy(() => import('../features/auth/BecomeTeacherPage'));
const LegalPage = lazy(() => import('../features/public/LegalPage'));
const AccountPage = lazy(() => import('../features/account/AccountPage'));
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'));
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'));
const TeacherRequestsPage = lazy(() => import('../features/admin/TeacherRequestsPage'));
const TeachersPage = lazy(() => import('../features/admin/TeachersPage'));
const TeacherDetailPage = lazy(() => import('../features/admin/TeacherDetailPage'));
const SubscriptionsPage = lazy(() => import('../features/admin/SubscriptionsPage'));
const AuditLogPage = lazy(() => import('../features/admin/AuditLogPage'));
const ComingSoon = lazy(() => import('./ComingSoon'));
const StyleGuide = lazy(() => import('./StyleGuide'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15000 } },
});

function Loading() {
  const { t } = useTranslation();
  return <Spinner label={t('common.loading')} />;
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

                <Route path="admin" element={<RoleShell roles={['admin']} />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="teacher-requests" element={<TeacherRequestsPage />} />
                  <Route path="teachers" element={<TeachersPage />} />
                  <Route path="teachers/:publicId" element={<TeacherDetailPage />} />
                  <Route path="subscriptions" element={<SubscriptionsPage />} />
                  <Route path="audit-log" element={<AuditLogPage />} />
                </Route>

                <Route path="teacher" element={<RoleShell roles={['teacher']} />}>
                  <Route index element={<ComingSoon title="common.dashboard" />} />
                </Route>

                <Route path="student" element={<RoleShell roles={['student']} />}>
                  <Route index element={<ComingSoon title="common.dashboard" />} />
                </Route>

                <Route element={<RoleShell roles={['admin', 'teacher', 'student']} />}>
                  <Route path="account" element={<AccountPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
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
