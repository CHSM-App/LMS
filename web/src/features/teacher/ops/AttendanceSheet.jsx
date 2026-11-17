import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, EmptyState, Spinner, useToast } from '../../../components';

// Present/absent per student of the class's batch (or every batch). Saving is an upsert.
export function AttendanceSheet({ liveClassId, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const q = useQuery({ queryKey: ['teacher', 'attendance', liveClassId], queryFn: () => api.get(`/teacher/live-classes/${liveClassId}/attendance`) });
  const [marks, setMarks] = useState({});
  useEffect(() => {
    if (q.data) setMarks(Object.fromEntries(q.data.data.map((r) => [r.studentPublicId, r.present])));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put(`/teacher/live-classes/${liveClassId}/attendance`, {
      records: q.data.data.map((r) => ({ studentPublicId: r.studentPublicId, present: marks[r.studentPublicId] === true })),
    }),
    onSuccess: () => {
      toast.show({ message: t('attendance.saved') });
      onDone();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const rows = q.data.data;
  if (!rows.length) return <EmptyState title={t('attendance.noStudents')} />;
  return (
    <div className="stack">
      <div className="row">
        <Button variant="compact" size="sm" onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.studentPublicId, true])))}>{t('attendance.allPresent')}</Button>
        <span className="muted">{t('attendance.count', { present: Object.values(marks).filter((v) => v === true).length, total: rows.length })}</span>
      </div>
      <ul className="attendance">
        {rows.map((r) => (
          <li key={r.studentPublicId} className="row row--between">
            <span>{r.name}</span>
            <span className="row" role="radiogroup" aria-label={r.name}>
              {[true, false].map((v) => (
                <label key={String(v)} className="checkbox">
                  <input type="radio" name={`att-${r.studentPublicId}`} checked={marks[r.studentPublicId] === v} onChange={() => setMarks((m) => ({ ...m, [r.studentPublicId]: v }))} />
                  {v ? t('status.present') : t('status.absent')}
                </label>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="row"><Button loading={save.isPending} onClick={() => save.mutate()}>{t('attendance.save')}</Button></div>
    </div>
  );
}
