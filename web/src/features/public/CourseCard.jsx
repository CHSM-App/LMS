import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fileUrl } from '../../api/client';
import { useBrowsePaths } from './browsePaths';

export function CourseCard({ course }) {
  const { t } = useTranslation();
  const paths = useBrowsePaths();
  return (
    <article className="course-card">
      <Link to={paths.course(course.slug)} className="course-card__link">
        <div className="course-card__thumb">
          {course.thumbnailUrl ? <img src={fileUrl(course.thumbnailUrl)} alt="" loading="lazy" /> : <span aria-hidden="true">{course.subject}</span>}
        </div>
        <h3 className="course-card__title">{course.title}</h3>
      </Link>
      <p className="course-card__teacher">{course.teacher.name}</p>
      <p className="course-card__meta muted">
        {course.subject} · {t(`courses.lang.${course.language}`)}
        {course.feeDisplay ? ` · ${course.feeDisplay}` : ''}
      </p>
    </article>
  );
}
