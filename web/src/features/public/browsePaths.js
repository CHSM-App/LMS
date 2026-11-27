import { useLocation } from 'react-router-dom';

// The course catalogue is shown in two places: the public site (/courses) and,
// for a signed-in student, inside the student area (/student/browse) so the sidebar stays.
export function useBrowsePaths() {
  const { pathname } = useLocation();
  const inStudent = pathname === '/student' || pathname.startsWith('/student/');
  return inStudent
    ? {
      inStudent,
      list: '/student/browse',
      course: (slug) => `/student/browse/${slug}`,
      teacher: (slug) => `/student/browse/teachers/${slug}`,
      enroll: (slug) => `/student/enroll/${slug}`,
    }
    : {
      inStudent,
      list: '/courses',
      course: (slug) => `/courses/${slug}`,
      teacher: (slug) => `/teachers/${slug}`,
      enroll: (slug) => `/enroll/${slug}`,
    };
}
