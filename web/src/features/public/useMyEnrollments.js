import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useBrowsePaths } from './browsePaths';

// For a signed-in student browsing the catalogue: which courses they already joined or asked to join.
// Reuses the dashboard response (approved courses in `myCourses`, everything else in `requests`),
// so no extra endpoint is needed. Returns { bySlug } where each value is { status, courseId?, rejectReason?, teacher? };
// status is 'enrolled' | 'pending' | 'rejected' | 'blocked'. Courses not in the map are open to enroll.
export function useMyEnrollments() {
  const { inStudent } = useBrowsePaths();
  const q = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard'), enabled: inStudent });
  const bySlug = {};
  const d = q.data?.data;
  if (d) {
    (d.requests || []).forEach((r) => {
      if (r.course?.slug) bySlug[r.course.slug] = { status: r.status, rejectReason: r.rejectReason, teacher: r.teacher };
    });
    (d.myCourses || []).forEach((c) => {
      if (c.slug) bySlug[c.slug] = { status: 'enrolled', courseId: c.courseId };
    });
  }
  return { bySlug, isLoading: inStudent && q.isLoading };
}
