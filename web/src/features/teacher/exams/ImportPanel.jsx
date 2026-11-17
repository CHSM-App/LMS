import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, fileUrl, getAccessToken } from '../../../api/client';
import { Banner, Button, Table } from '../../../components';

async function downloadTemplate() {
  const res = await fetch(fileUrl('/api/v1/teacher/questions/import-template'), {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    credentials: 'include',
  });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'question-import-template.xlsx';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Bulk import from the Excel template with a per-row error report (spec §5).
export function ImportPanel({ moduleId, onDone }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.form(`/teacher/modules/${moduleId}/questions/import`, fd);
      setResult(r.data);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="muted">{t('import.intro')}</p>
      <div className="row">
        <Button variant="secondary" onClick={downloadTemplate}>{t('import.template')}</Button>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="import-file">{t('import.file')}</label>
        <input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files[0] || null)} />
      </div>
      <div className="row"><Button onClick={run} loading={busy} disabled={!file}>{t('import.run')}</Button></div>
      {error && <Banner kind="error" message={error} />}
      {result && (
        <>
          <Banner
            kind={result.errors.length ? 'warning' : 'success'}
            message={result.errors.length ? t('import.summaryErrors', { imported: result.imported, count: result.errors.length }) : t('import.summary', { imported: result.imported })}
            action={result.errorFileUrl ? <a href={fileUrl(result.errorFileUrl)}>{t('import.download')}</a> : null}
          />
          {result.errors.length > 0 && (
            <Table
              columns={[
                { key: 'row', header: t('import.row') },
                { key: 'field', header: t('import.field') },
                { key: 'message', header: t('import.problem') },
              ]}
              rows={result.errors}
              rowKey={(r) => `${r.row}-${r.field}`}
            />
          )}
        </>
      )}
    </div>
  );
}
