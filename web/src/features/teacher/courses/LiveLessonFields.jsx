import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Input, Select } from '../../../components';

// datetime-local works in the browser's time zone (IST for our users); the API gets UTC ISO.
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export const emptyLive = (item) => ({
  startsAt: item?.live ? toLocalInput(item.live.startsAt) : '',
  durationMin: item?.live?.durationMin || 60,
  meetLink: item?.live ? item.live.meetLink || '' : '',
  batchId: item?.live?.batch ? String(item.live.batch.id) : '',
});

// Body fields for a live lesson. No date: {} (the lesson is added without a date and batches are scheduled later).
// A batch without a date: { error: 'needDate' }.
export function liveBody(v) {
  if (!v.startsAt) return v.batchId ? { error: 'needDate' } : {};
  return {
    startsAt: new Date(v.startsAt).toISOString(),
    durationMin: Number(v.durationMin) || 60,
    meetLink: v.meetLink.trim() || null,
    batchId: v.batchId ? Number(v.batchId) : null,
  };
}

// forBatch: scheduling one batch of an existing lesson (date and batch required, no "All batches").
export function LiveLessonFields({ courseId, value, onChange, forBatch = false }) {
  const { t } = useTranslation();
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(courseId)], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`) });
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const options = (batches.data?.data || []).filter((b) => !forBatch || b.status !== 'closed').map((b) => ({ value: String(b.id), label: b.name }));
  return (
    <>
      <div className="grid grid--2">
        <Input label={t('content.live.startsAt')} type="datetime-local" value={value.startsAt} onChange={set('startsAt')} required={forBatch}
          hint={forBatch ? undefined : t('content.live.dateOptionalHint')} />
        <Input label={t('content.live.duration')} type="number" min="5" max="600" value={value.durationMin} onChange={set('durationMin')} />
      </div>
      <Select label={t('content.live.batch')} value={value.batchId} onChange={set('batchId')} required={forBatch}
        options={[{ value: '', label: forBatch ? '—' : t('content.live.allBatches') }, ...options]} />
      <Input label={`${t('content.live.meetLink')} (${t('common.optional')})`} value={value.meetLink} onChange={set('meetLink')}
        placeholder="https://meet.google.com/abc-defg-hij" hint={t('content.live.meetLinkHint')} />
    </>
  );
}
