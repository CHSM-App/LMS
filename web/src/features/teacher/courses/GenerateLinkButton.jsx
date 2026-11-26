import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button } from '../../../components';

// "Generate link" in a schedule form: asks the API for a Meet link and hands it to the Meet link field.
// Nothing is saved here; the link is saved with the class. startsAt is a datetime-local value.
export function GenerateLinkButton({ topic, startsAt, durationMin = 60, onLink }) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.post('/teacher/live-classes/meet-link/generate', {
      topic: topic.trim(),
      startsAt: new Date(startsAt).toISOString(),
      durationMin: Number(durationMin) || 60,
    }),
    onSuccess: (res) => { setError(''); onLink(res.data.meetLink); },
    onError: (e) => setError(e.message),
  });
  const ready = Boolean(topic && topic.trim() && startsAt);
  return (
    <div className="stack">
      <div>
        <Button type="button" variant="secondary" size="sm" loading={m.isPending} disabled={!ready} onClick={() => m.mutate()}>{t('content.live.generateLink')}</Button>
        {!ready && <span className="muted"> {t('content.live.generateNeedsDate')}</span>}
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}
