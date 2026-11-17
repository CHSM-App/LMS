import { api } from '../api/client';

// Small files (thumbnail, photo, pdf): one multipart request.
export async function uploadSmall(kind, file) {
  const fd = new FormData();
  fd.append('kind', kind);
  fd.append('file', file);
  const r = await api.form('/uploads', fd);
  return r.data;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Videos: 5 MB chunks. A failed chunk asks the server where it stopped and continues from there.
export async function uploadResumable(kind, file, { onProgress, signal, uploadId: existing, retries = 4, retryDelayMs = 1500 } = {}) {
  let uploadId = existing;
  let chunkSize;
  let offset = 0;
  if (!uploadId) {
    const s = await api.post('/uploads/sessions', { kind, fileName: file.name, totalBytes: file.size });
    ({ uploadId, chunkSize } = s.data);
    offset = s.data.receivedBytes || 0;
  } else {
    const st = await api.get(`/uploads/sessions/${uploadId}`);
    offset = st.data.receivedBytes;
    chunkSize = 5 * 1024 * 1024;
  }
  const report = () => onProgress && onProgress(file.size ? Math.min(100, (offset / file.size) * 100) : 100);
  report();
  let failures = 0;
  while (offset < file.size) {
    if (signal && signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    const end = Math.min(offset + chunkSize, file.size) - 1;
    try {
      const r = await api.putChunk(`/uploads/sessions/${uploadId}`, file.slice(offset, end + 1), `bytes ${offset}-${end}/${file.size}`);
      offset = r.data.receivedBytes;
      failures = 0;
      report();
    } catch (err) {
      failures += 1;
      if (failures > retries) {
        err.uploadId = uploadId;
        throw err;
      }
      if (retryDelayMs) await sleep(retryDelayMs * failures);
      const st = await api.get(`/uploads/sessions/${uploadId}`);
      offset = st.data.receivedBytes;
    }
  }
  const done = await api.post(`/uploads/sessions/${uploadId}/complete`);
  onProgress && onProgress(100);
  return done.data.key;
}
