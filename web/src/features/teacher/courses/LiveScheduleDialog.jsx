import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, EmptyState, Input, LiveStageBadge, Modal, Spinner, useToast } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { GenerateLinkButton } from './GenerateLinkButton';

// Live schedule of one batch: every live lesson of the course, with a date to fill for each lesson
// the batch has no session of yet. One save schedules all filled rows (all or nothing on the server).
export function LiveScheduleDialog({ courseId, batch, onClose }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [dates, setDates] = useState({});
  const [links, setLinks] = useState({});
  const [error, setError] = useState('');
  const path = `/teacher/courses/${courseId}/batches/${batch.id}/live-schedule`;
  const q = useQuery({ queryKey: ['teacher', 'live-schedule', courseId, batch.id], queryFn: () => api.get(path) });
  const m = useMutation({
    mutationFn: (body) => api.post(path, body),
    onSuccess: () => {
      toast.show({ message: t('common.saved') });
      qc.invalidateQueries({ queryKey: ['teacher', 'curriculum', courseId] });
      qc.invalidateQueries({ queryKey: ['teacher', 'live-schedule', courseId, batch.id] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const rows = q.data?.data || [];
  const submit = () => {
    const items = rows
      .filter((r) => !r.session && dates[r.slotId])
      .map((r) => ({ slotId: r.slotId, startsAt: new Date(dates[r.slotId]).toISOString(), durationMin: 60, meetLink: (links[r.slotId] || '').trim() || null }));
    if (!items.length) return setError(t('batches.liveScheduleNothing'));
    setError('');
    return m.mutate({ items });
  };
  return (
    <Modal open size="lg" title={t('batches.liveScheduleTitle', { name: batch.name })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit} disabled={!rows.length}>{t('batches.liveScheduleSave')}</Button></>}>
      <p className="muted">{t('batches.liveScheduleIntro')}</p>
      {q.isLoading && <Spinner label={t('common.loading')} />}
      {q.error && <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />}
      {q.data && !rows.length && <EmptyState title={t('batches.liveScheduleEmpty')} />}
      <ul className="stack">
        {rows.map((r) => (
          <li key={r.slotId}>
            <strong>{r.title}</strong> <span className="muted">· {r.module.name}</span>
            {!r.session && r.allBatches && (
              <p className="row"><LiveStageBadge stage={r.allBatches.stage} /> <span className="muted">{t('content.live.allBatches')} · {formatDateTime(r.allBatches.startsAt, i18n.language)}</span></p>
            )}
            {r.session
              ? <p className="row"><LiveStageBadge stage={r.session.stage} /> <span className="muted">{formatDateTime(r.session.startsAt, i18n.language)}</span></p>
              : (
                <div className="grid grid--2">
                  <Input label={t('content.live.startsAt')} type="datetime-local" value={dates[r.slotId] || ''} onChange={(e) => setDates((d) => ({ ...d, [r.slotId]: e.target.value }))} />
                  <Input label={`${t('content.live.meetLink')} (${t('common.optional')})`} value={links[r.slotId] || ''} placeholder="https://meet.google.com/abc-defg-hij"
                    onChange={(e) => setLinks((d) => ({ ...d, [r.slotId]: e.target.value }))} />
                  <GenerateLinkButton topic={r.title} startsAt={dates[r.slotId] || ''} onLink={(link) => setLinks((d) => ({ ...d, [r.slotId]: link }))} />
                </div>
              )}
          </li>
        ))}
      </ul>
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}
