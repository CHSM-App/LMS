import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Input, Select } from '../../../components';

// datetime-local works in the browser's time zone (IST for our users); the API gets UTC ISO.
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export const emptyLive = (item) => ({
  startsAt: item?.live ? toLocalInput(item.live.startsAt) : '',
  durationMin: item?.live ? item.live.durationMin : 60,
  meetLink: item?.live ? item.live.meetLink || '' : '',
  batchId: item?.live?.batch ? String(item.live.batch.id) : '',
});

// Body fields for a live lesson. Returns null when the date is missing.
export function liveBody(v) {
  if (!v.startsAt) return null;
  return {
    startsAt: new Date(v.startsAt).toISOString(),
    durationMin: Number(v.durationMin) || 60,
    meetLink: v.meetLink.trim() || null,
    batchId: v.batchId ? Number(v.batchId) : null,
  };
}

export function LiveLessonFields({ courseId, value, onChange }) {
  const { t } = useTranslation();
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(courseId)], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`) });
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <div className="grid grid--2">
        <Input label={t('content.live.startsAt')} type="datetime-local" value={value.startsAt} onChange={set('startsAt')} required />
        <Input label={t('content.live.duration')} type="number" min="5" max="600" value={value.durationMin} onChange={set('durationMin')} />
      </div>
      <Select label={t('content.live.batch')} value={value.batchId} onChange={set('batchId')}
        options={[{ value: '', label: t('content.live.allBatches') }, ...(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      <Input label={`${t('content.live.meetLink')} (${t('common.optional')})`} value={value.meetLink} onChange={set('meetLink')}
        placeholder="https://meet.google.com/abc-defg-hij" hint={t('content.live.meetLinkHint')} />
    </>
  );
}

const STAGE_CLASS = { upcoming: 'info', live: 'pending', recorded: 'approved', ended: 'neutral', cancelled: 'neutral' };

export function LiveStageBadge({ stage }) {
  const { t } = useTranslation();
  return <span className={`badge badge--${STAGE_CLASS[stage] || 'neutral'}`}>{t(`content.live.stage.${stage}`)}</span>;
}
