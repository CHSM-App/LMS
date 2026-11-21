import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fileUrl } from '../../api/client';
import { useBrowsePaths } from './browsePaths';

// Compact catalogue card: thumbnail, teacher, title, then one quiet meta line and the demo badge.
export function CourseCard({ course, status }) {
  const { t } = useTranslation();
  const paths = useBrowsePaths();
  const initial = (course.teacher.name || '?').trim().charAt(0).toUpperCase();
  return (
    <article className="course-card">
      <Link to={paths.course(course.slug)} className="course-card__link">
        <div className="course-card__thumb">
          {course.thumbnailUrl ? <img src={fileUrl(course.thumbnailUrl)} alt="" loading="lazy" /> : (
            // No thumbnail: a generated cover (DECISIONS "Course thumbnail is optional").
            <div className="course-cover" aria-hidden="true" data-testid="course-cover">
              <span className="course-cover__subject">{course.subject}</span>
              <span className="course-cover__title">{course.title}</span>
            </div>
          )}
        </div>
        <div className="course-card__body">
          <div className="course-card__teacher">
            {course.teacher.photoUrl
              ? <img src={fileUrl(course.teacher.photoUrl)} alt="" className="course-card__avatar" loading="lazy" />
              : <span className="course-card__avatar course-card__avatar--initial" aria-hidden="true">{initial}</span>}
            <span>{course.teacher.name}</span>
          </div>
          <h3 className="course-card__title">{course.title}</h3>
          <div className="course-card__tags">
            <span className="tag tag--subject">{course.subject}</span>
            <span className="tag">{t(`courses.lang.${course.language}`)}</span>
          </div>
        </div>
      </Link>
      <div className="course-card__foot">
        {status === 'enrolled' && <span className="tag tag--enrolled">{t('home.enrolledBadge')}</span>}
        {status === 'pending' && <span className="tag tag--requested">{t('home.requestedBadge')}</span>}
        {!status && <span className="tag tag--demo">{t('home.freeDemo')}</span>}
        <span className="course-card__fee">{course.feeDisplay || ''}</span>
      </div>
    </article>
  );
}
