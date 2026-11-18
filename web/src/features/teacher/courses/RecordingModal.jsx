import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../components';
import { VideoSourceField } from './VideoSourceField';

// Add the recording of a live lesson: upload, or a YouTube (unlisted) / Vimeo / Bunny link.
export function RecordingModal({ lesson, onSave, onClose, saving }) {
  const { t } = useTranslation();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');
  const submit = () => {
    if (!video) return setError(t('curriculum.needVideo'));
    return onSave(video.source === 'upload' ? { videoSource: 'upload', fileKey: video.fileKey } : { videoSource: video.source, url: video.url });
  };
  return (
    <Modal open size="lg" title={t('content.live.addRecording')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={saving} onClick={submit}>{t('common.save')}</Button></>}>
      <p className="muted">{lesson.title}</p>
      <VideoSourceField label={t('content.live.recording')} kind="video" value={video} onChange={setVideo} required />
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}
