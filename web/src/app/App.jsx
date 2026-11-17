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
const CoursesPage = lazy(() => import('../features/teacher/courses/CoursesPage'));
const CourseEditorPage = lazy(() => import('../features/teacher/courses/CourseEditorPage'));
const QuestionBankPage = lazy(() => import('../features/teacher/exams/QuestionBankPage'));
const ExamsPage = lazy(() => import('../features/teacher/exams/ExamsPage'));
const ExamBuilderPage = lazy(() => import('../features/teacher/exams/ExamBuilderPage'));
const ExamResultsPage = lazy(() => import('../features/teacher/exams/ExamResultsPage'));
const TeacherDashboard = lazy(() => import('../features/teacher/ops/TeacherDashboard'));
const RequestsPage = lazy(() => import('../features/teacher/ops/RequestsPage'));
const StudentsPage = lazy(() => import('../features/teacher/ops/StudentsPage'));
const LiveClassesPage = lazy(() => import('../features/teacher/ops/LiveClassesPage'));
const DoubtsPage = lazy(() => import('../features/teacher/ops/DoubtsProgramsProfile').then((m) => ({ default: m.DoubtsPage })));
const ProgramsPage = lazy(() => import('../features/teacher/ops/DoubtsProgramsProfile').then((m) => ({ default: m.ProgramsPage })));
const ProfilePage = lazy(() => import('../features/teacher/ops/DoubtsProgramsProfile').then((m) => ({ default: m.ProfilePage })));
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
                  <Route index element={<TeacherDashboard />} />
                  <Route path="requests" element={<RequestsPage />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="live-classes" element={<LiveClassesPage />} />
                  <Route path="doubts" element={<DoubtsPage />} />
                  <Route path="programs" element={<ProgramsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="courses" element={<CoursesPage />} />
                  <Route path="courses/:courseId" element={<CourseEditorPage />} />
                  <Route path="question-bank" element={<QuestionBankPage />} />
                  <Route path="exams" element={<ExamsPage />} />
                  <Route path="exams/new" element={<ExamBuilderPage />} />
                  <Route path="exams/:examId" element={<ExamBuilderPage />} />
                  <Route path="exams/:examId/results" element={<ExamResultsPage />} />
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
