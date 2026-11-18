import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Input, Modal } from '../../../components';

// Teacher side of a class's Meet link: "Join" opens Meet when the link exists;
// "Add Meet link" asks for one when it doesn't. The teacher can open Meet any time (host).
export function MeetLinkAction({ liveClass: r, onSaved, size = 'sm' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (r.meetLink) {
    return (
      <a className={`btn btn--compact btn--${size}`} href={r.meetLink} target="_blank" rel="noopener noreferrer">
        <span className="btn__label">{t('liveClasses.join')}</span>
      </a>
    );
  }
  if (!r.needsMeetLink) return <span className="muted">{t('liveClasses.noLink')}</span>;
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>{t('liveClasses.addLink')}</Button>
      {open && <AddLinkDialog id={r.id} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved?.(); }} />}
    </>
  );
}

function AddLinkDialog({ id, onClose, onSaved }) {
  const { t } = useTranslation();
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.put(`/teacher/live-classes/${id}/meet-link`, { meetLink: link.trim() }),
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  return (
    <Modal open title={t('liveClasses.addLinkTitle')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={() => (link.trim() ? m.mutate() : setError(t('validation.required')))}>{t('liveClasses.saveLink')}</Button></>}>
      <Input label={t('liveClasses.linkLabel')} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij"
        hint={t('liveClasses.addLinkHint')} error={error} required />
    </Modal>
  );
}
