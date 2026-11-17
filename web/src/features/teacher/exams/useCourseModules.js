import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';

// The teacher's courses, and the chosen course's modules labelled "Subject › Module".
export function useCourseModules(courseId) {
  const courses = useQuery({ queryKey: ['teacher', 'courses'], queryFn: () => api.get('/teacher/courses') });
  const tree = useQuery({
    queryKey: ['teacher', 'curriculum', Number(courseId)],
    queryFn: () => api.get(`/teacher/courses/${courseId}/curriculum`),
    enabled: !!courseId,
  });
  const modules = (tree.data?.data.subjects || []).flatMap((s) => s.modules.map((m) => ({ id: m.id, name: m.name, label: `${s.name} › ${m.name}` })));
  return { courses: courses.data?.data || [], modules, loading: courses.isLoading || tree.isLoading };
}
