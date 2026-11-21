import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../../api/client';
import { Button, Input, Modal, PageHeader, Select, StatusBadge, Table, Textarea } from '../../../components';
import { formatDate } from '../../../utils/format';

export const LANGUAGE_OPTIONS = (t) => ['en', 'mr', 'hi', 'other'].map((v) => ({ value: v, label: t(`courses.lang.${v}`) }));

function NewCourseDialog({ onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', subject: '', language: 'mr', description: '' });
  const [errors, setErrors] = useState({});
  const m = useMutation({
    mutationFn: () => api.post('/teacher/courses', f),
    onSuccess: (r) => navigate(`/teacher/courses/${r.data.id}`),
    onError: (e) => setErrors({ server: e.message }),
  });
  const submit = () => {
    const e = {};
    ['title', 'subject', 'description'].forEach((k) => { if (!f[k].trim()) e[k] = t('validation.required'); });
    setErrors(e);
    if (!Object.keys(e).length) m.mutate();
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open title={t('courses.new')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('courses.createDraft')}</Button></>}>
      <Input label={t('courses.title')} value={f.title} onChange={set('title')} error={errors.title} required />
      <Input label={t('courses.subject')} value={f.subject} onChange={set('subject')} error={errors.subject} required />
      <Select label={t('courses.language')} value={f.language} onChange={set('language')} options={LANGUAGE_OPTIONS(t)} required />
      <Textarea label={t('courses.description')} value={f.description} onChange={set('description')} error={errors.description} required />
      {errors.server && <p className="field__error" role="alert">{errors.server}</p>}
    </Modal>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

export default function CoursesPage() {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['teacher', 'courses'], queryFn: () => api.get('/teacher/courses') });
  const all = q.data?.data || [];
  const published = all.filter((c) => c.status === 'published').length;
  const lessons = all.reduce((n, c) => n + (c.contentCount || 0), 0);
  const needle = search.trim().toLowerCase();
  const shown = all.filter((c) => (filter === 'all' || c.status === filter)
    && (!needle || `${c.title} ${c.subject}`.toLowerCase().includes(needle)));
  const tabs = [['all', t('courses.filterAll')], ['published', t('status.published')], ['draft', t('status.draft')]];

  const columns = [
    {
      key: 'title',
      header: t('courses.title'),
      render: (c) => (
        <div className="row">
          {c.thumbnailUrl
            ? <img src={fileUrl(c.thumbnailUrl)} alt="" width="96" height="54" className="thumb-md" />
            : <span className="thumb-md thumb-md--empty" aria-hidden="true">{(c.title || '?').charAt(0).toUpperCase()}</span>}
          <Link to={`/teacher/courses/${c.id}`}>{c.title}</Link>
        </div>
      ),
    },
    { key: 'subject', header: t('courses.subject') },
    { key: 'language', header: t('courses.language'), render: (c) => t(`courses.lang.${c.language}`) },
    { key: 'contentCount', header: t('courses.lessons'), align: 'right' },
    { key: 'status', header: t('common.status'), render: (c) => <StatusBadge status={c.status} /> },
    { key: 'updatedAt', header: t('courses.updated'), render: (c) => formatDate(c.updatedAt, i18n.language) },
  ];

  return (
    <>
      <PageHeader title={t('nav.courses')} subtitle={t('courses.subtitle')} actions={<Button onClick={() => setCreating(true)}>{t('courses.new')}</Button>} />
      {q.isLoading && <p role="status" className="muted">{t('common.loading', { defaultValue: 'Loading…' })}</p>}
      {q.error && (
        <div className="empty" role="alert">
          <p className="empty__title">{q.error.message}</p>
          <Button variant="secondary" onClick={q.refetch}>{t('common.retry', { defaultValue: 'Retry' })}</Button>
        </div>
      )}
      {!q.isLoading && !q.error && all.length === 0 && (
        <div className="empty">
          <p className="empty__title">{t('courses.empty')}</p>
          <Button onClick={() => setCreating(true)}>{t('courses.new')}</Button>
        </div>
      )}
      {all.length > 0 && (
        <>
          <div className="stat-row">
            <StatTile label={t('courses.stats.total')} value={all.length} />
            <StatTile label={t('courses.stats.published')} value={published} />
            <StatTile label={t('courses.stats.drafts')} value={all.length - published} />
            <StatTile label={t('courses.stats.lessons')} value={lessons} />
          </div>
          <div className="course-toolbar">
            <div className="course-toolbar__tabs" role="group" aria-label={t('common.status')}>
              {tabs.map(([k, label]) => (
                <button key={k} type="button" className="filter-pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            <input type="search" className="course-toolbar__search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('courses.search')} aria-label={t('courses.search')} />
          </div>
          <Table columns={columns} rows={shown} empty={t('courses.noMatch')} />
        </>
      )}
      {creating && <NewCourseDialog onClose={() => setCreating(false)} />}
    </>
  );
}
