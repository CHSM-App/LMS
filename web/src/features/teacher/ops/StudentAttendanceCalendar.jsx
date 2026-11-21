import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, EmptyState, Modal, Spinner } from '../../../components';

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;

// One student's attendance as a month calendar. A student in two courses shows both on the same days.
export function StudentAttendanceCalendar({ student, onClose }) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const month = monthKey(cursor.y, cursor.m);
  const q = useQuery({
    queryKey: ['teacher', 'student-attendance', student.publicId, month],
    queryFn: () => api.get(`/teacher/students/${student.publicId}/attendance`, { month }),
  });
  const move = (d) => setCursor(({ y, m }) => {
    const x = new Date(y, m + d, 1);
    return { y: x.getFullYear(), m: x.getMonth() };
  });

  const lang = i18n.language;
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(cursor.y, cursor.m, 1));
  const weekdays = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2023, 0, 1 + i))); // 1 Jan 2023 is a Sunday
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = new Date(cursor.y, cursor.m, 1).getDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const data = q.data?.data;
  const byDate = new Map((data?.days || []).map((d) => [d.date, d.classes]));
  const totals = (data?.courses || []).map((c) => {
    const all = (data.days || []).flatMap((d) => d.classes).filter((x) => x.course.id === c.id);
    return { ...c, held: all.length, attended: all.filter((x) => x.present).length };
  });

  return (
    <Modal open title={t('students.attendanceTitle', { name: student.name })} onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      <div className="row row--between">
        <Button variant="compact" size="sm" onClick={() => move(-1)}>{t('common.previous')}</Button>
        <strong aria-live="polite">{monthLabel}</strong>
        <Button variant="compact" size="sm" onClick={() => move(1)}>{t('common.next')}</Button>
      </div>
      {q.isLoading && <Spinner label={t('common.loading')} />}
      {q.error && <EmptyState title={q.error.message} />}
      {data && (
        <>
          <div className="attcal" role="grid" aria-label={monthLabel}>
            {weekdays.map((w) => <div key={w} className="attcal__head" role="columnheader">{w}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={`b${i}`} className="attcal__cell attcal__cell--blank" role="gridcell" />;
              const classes = byDate.get(`${month}-${pad(d)}`) || [];
              return (
                <div key={d} className="attcal__cell" role="gridcell">
                  <span className="attcal__day">{d}</span>
                  {classes.map((c) => (
                    <span key={c.liveClassId} className={`attcal__mark attcal__mark--${c.present ? 'present' : 'absent'}`} title={`${c.course.title} · ${c.topic} · ${c.time}`}>
                      <span className="sr-only">{c.present ? t('status.present') : t('status.absent')}: </span>
                      {c.present ? '✓' : '✗'} {c.course.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          {!byDate.size && <p className="muted">{t('students.noClassesMonth')}</p>}
          {totals.length > 0 && (
            <ul className="attcal__summary">
              {totals.map((c) => (
                <li key={c.id}><strong>{c.title}</strong>: {c.held > 0 ? t('students.attendanceValue', { pct: Math.round((c.attended / c.held) * 100), attended: c.attended, held: c.held }) : '—'}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
