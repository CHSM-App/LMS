import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, UploadProgress, VideoFrame } from '../../../components';
import { uploadResumable } from '../../../utils/upload';
import { fileUrl } from '../../../api/client';

const PATTERNS = {
  youtube: /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/,
  vimeo: /^https:\/\/(www\.|player\.)?vimeo\.com\/(video\/)?\d+/,
  bunny: /^https:\/\/(iframe|video|player)\.mediadelivery\.net\/(embed|play)\/\d+\/[\w-]+/,
};
const NAMES = { youtube: 'YouTube', vimeo: 'Vimeo', bunny: 'Bunny Stream' };

export const isValidVideoLink = (source, url) => !!PATTERNS[source] && PATTERNS[source].test(String(url || '').trim());

// Link OR upload for each video (DECISIONS.md). value: { source, url } | { source: 'upload', fileKey, url } | null
export function VideoSourceField({ label, value, onChange, kind = 'video', required }) {
  const { t } = useTranslation();
  const id = useId();
  const [source, setSource] = useState(value?.source || '');
  const [link, setLink] = useState(value && value.source !== 'upload' ? value.url : '');
  const [error, setError] = useState('');
  const [upload, setUpload] = useState(null);
  const abort = useRef(null);

  useEffect(() => () => abort.current && abort.current.abort(), []);

  const commitLink = () => {
    if (!link) return;
    if (!isValidVideoLink(source, link)) {
      setError(t('video.invalidLink', { name: NAMES[source] }));
      return;
    }
    setError('');
    onChange({ source, url: link.trim() });
  };

  const startUpload = async (file, uploadId) => {
    if (!file) return;
    if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') {
      setError(t('video.onlyMp4'));
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError(t('video.tooBig'));
      return;
    }
    setError('');
    abort.current = new AbortController();
    setUpload({ file, percent: 0, failed: false });
    try {
      const key = await uploadResumable(kind, file, {
        uploadId,
        signal: abort.current.signal,
        onProgress: (p) => setUpload((u) => u && { ...u, percent: p }),
      });
      setUpload(null);
      onChange({ source: 'upload', fileKey: key });
    } catch (e) {
      if (e.name === 'AbortError') setUpload(null);
      else setUpload((u) => u && { ...u, failed: true, uploadId: e.uploadId, message: e.message });
    }
  };

  return (
    <fieldset className="video-field">
      <legend className="field__label">{label}{required && <span className="field__required" aria-hidden="true"> *</span>}</legend>
      <Select
        id={`${id}-src`}
        label={t('video.source')}
        value={source}
        placeholder={t('video.choose')}
        onChange={(e) => { setSource(e.target.value); setError(''); }}
        options={[
          { value: 'upload', label: t('video.upload') },
          { value: 'youtube', label: 'YouTube' },
          { value: 'vimeo', label: 'Vimeo' },
          { value: 'bunny', label: 'Bunny Stream' },
        ]}
      />
      {source && source !== 'upload' && (
        <Input label={t('video.link')} type="url" value={link} onChange={(e) => setLink(e.target.value)} onBlur={commitLink} error={error} placeholder="https://" />
      )}
      {source === 'upload' && !upload && (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-file`}>{t('video.chooseFile')}</label>
          <input id={`${id}-file`} type="file" accept="video/mp4" onChange={(e) => startUpload(e.target.files[0])} />
          <p className="field__hint">{t('video.uploadHint')}</p>
          {error && <p className="field__error" role="alert">{error}</p>}
        </div>
      )}
      {upload && (
        <UploadProgress
          fileName={upload.file.name}
          percent={upload.percent}
          failed={upload.failed}
          onCancel={() => abort.current && abort.current.abort()}
          onRetry={() => startUpload(upload.file, upload.uploadId)}
        />
      )}
      {value && !upload && (
        <div className="video-field__preview">
          <VideoFrame source={value.source} url={value.source === 'upload' ? fileUrl(value.url) : value.url} title={label} />
          {value.source === 'upload' && !value.url && <p className="field__hint">{t('video.uploaded')}</p>}
        </div>
      )}
    </fieldset>
  );
}
