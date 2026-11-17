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

export default function CoursesPage() {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['teacher', 'courses'], queryFn: () => api.get('/teacher/courses') });
  const columns = [
    {
      key: 'title',
      header: t('courses.title'),
      render: (c) => (
        <div className="row">
          {c.thumbnailUrl && <img src={fileUrl(c.thumbnailUrl)} alt="" width="64" height="36" className="thumb-sm" />}
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
      <Table
        columns={columns}
        rows={q.data?.data}
        loading={q.isLoading}
        error={q.error?.message}
        onRetry={q.refetch}
        empty={t('courses.empty')}
      />
      {creating && <NewCourseDialog onClose={() => setCreating(false)} />}
    </>
  );
}
