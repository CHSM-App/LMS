import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../components';
import { LiveLessonFields, emptyLive, liveBody } from './LiveLessonFields';

// "Add batch" on a live lesson: one more batch gets its own date, Meet link, attendance and recording.
export function LiveSessionDialog({ courseId, lesson, onSave, onClose, saving, error }) {
  const { t } = useTranslation();
  const [v, setV] = useState(() => emptyLive(null));
  const [local, setLocal] = useState('');
  const submit = () => {
    const b = liveBody(v);
    if (!v.startsAt || !b.batchId) return setLocal(t('validation.required'));
    return onSave({ batchId: b.batchId, startsAt: b.startsAt, durationMin: b.durationMin, meetLink: b.meetLink });
  };
  return (
    <Modal open size="lg" title={t('content.live.addBatchTitle', { title: lesson.title })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={saving} onClick={submit}>{t('common.save')}</Button></>}>
      <LiveLessonFields courseId={courseId} value={v} onChange={setV} forBatch />
      {(local || error) && <p className="field__error" role="alert">{local || error}</p>}
    </Modal>
  );
}
