import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { BackLink, Button, Card, Input, Modal, PageHeader, Spinner, EmptyState, StatusBadge, Table, Textarea, useToast } from '../../components';
import { formatDate, isValidMobile } from '../../utils/format';
import { BlockDialog, useActivate } from './TeachersPage';
import { SubscriptionForm } from './SubscriptionForm';
import { useSaveSubscription } from './SubscriptionsPage';

function ChangeMobileDialog({ teacher, onClose, onDone }) {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/users/${teacher.publicId}/change-mobile`, { newMobile: mobile, reason }),
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const submit = () => {
    if (!isValidMobile(mobile)) return setError(t('auth.invalidMobile'));
    if (reason.trim().length < 3) return setError(t('validation.required'));
    return m.mutate();
  };
  return (
    <Modal open title={t('teachers.changeMobileTitle', { name: teacher.name })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('account.confirmChange')}</Button></>}>
      <p className="muted">{t('teachers.changeMobileIntro')}</p>
      <Input label={t('account.newMobile')} type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
      <Textarea label={t('common.reason')} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('teachers.changeMobileReasonHint')} />
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

export default function TeacherDetailPage() {
  const { publicId } = useParams();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [blocking, setBlocking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'teacher', publicId], queryFn: () => api.get(`/admin/teachers/${publicId}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const activate = useActivate(refresh);
  const save = useSaveSubscription(editing, () => { setEditing(null); setAdding(false); refresh(); });

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;

  return (
    <div className="stack">
      <div><BackLink to="/admin/teachers">{t('teachers.back')}</BackLink></div>
      <PageHeader
        title={d.name}
        subtitle={<StatusBadge status={d.status} />}
        actions={
          <>
            {d.status === 'blocked' ? (
              <Button variant="compact" loading={activate.isPending} onClick={() => activate.mutate(d)}>{t('teachers.activate')}</Button>
            ) : (
              <Button variant="secondary" onClick={() => setBlocking(true)}>{t('teachers.block')}</Button>
            )}
            <Button variant="secondary" onClick={() => setChanging(true)}>{t('teachers.changeMobile')}</Button>
          </>
        }
      />
      <Card title={t('teacherRequests.details')}>
        <dl className="dl">
          <dt>{t('common.mobile')}</dt><dd>{d.mobile}</dd>
          <dt>{t('teacherRequests.subject')}</dt><dd>{d.subject || '—'}</dd>
          <dt>{t('teacherRequests.experience')}</dt><dd>{d.experienceYears != null ? t('teacherRequests.years', { n: d.experienceYears }) : '—'}</dd>
          <dt>{t('teacherReg.qualification')}</dt><dd>{d.qualification || '—'}</dd>
          <dt>{t('common.email')}</dt><dd>{d.email || '—'}</dd>
          <dt>{t('common.city')}</dt><dd>{d.city || '—'}</dd>
          <dt>{t('teachers.joined')}</dt><dd>{formatDate(d.joinedAt, i18n.language)}</dd>
          <dt>{t('teachers.students')}</dt><dd>{d.studentCount}</dd>
          {d.photoUrl && (<><dt>{t('teacherRequests.photo')}</dt><dd><a href={fileUrl(d.photoUrl)} target="_blank" rel="noreferrer">{t('common.view')}</a></dd></>)}
        </dl>
      </Card>
      <Card title={t('nav.courses')}>
        <Table
          columns={[
            { key: 'title', header: t('teachers.course') },
            { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
            { key: 'studentCount', header: t('teachers.students'), align: 'right' },
          ]}
          rows={d.courses || []}
          empty={t('teachers.noCourses')}
        />
        <p className="muted">{t('teachers.courseNote')}</p>
      </Card>
      <Card title={t('nav.subscriptions')} actions={<Button variant="compact" size="sm" onClick={() => setAdding(true)}>{t('subscriptions.add')}</Button>}>
        <Table
          columns={[
            { key: 'planType', header: t('subscriptions.plan'), render: (r) => t(`subscriptions.plans.${r.planType}`) },
            { key: 'startDate', header: t('subscriptions.startDate'), render: (r) => formatDate(r.startDate, i18n.language) },
            { key: 'endDate', header: t('subscriptions.endDate'), render: (r) => formatDate(r.endDate, i18n.language) },
            { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
            { key: 'a', header: t('common.actions'), render: (r) => <Button variant="compact" size="sm" onClick={() => setEditing(r)}>{t('common.edit')}</Button> },
          ]}
          rows={d.subscriptions}
          empty={t('subscriptions.noneForTeacher')}
        />
      </Card>
      {blocking && <BlockDialog teacher={d} onClose={() => setBlocking(false)} onDone={() => { setBlocking(false); refresh(); }} />}
      {changing && <ChangeMobileDialog teacher={d} onClose={() => setChanging(false)} onDone={() => { setChanging(false); toast.show({ message: t('account.changed') }); refresh(); }} />}
      <Modal open={adding || !!editing} title={editing ? t('subscriptions.editTitle', { name: d.name }) : t('subscriptions.add')} onClose={() => { setAdding(false); setEditing(null); }}>
        {(adding || editing) && (
          <SubscriptionForm
            key={editing ? editing.id : 'new'}
            teachers={[{ publicId: d.publicId, name: d.name }]}
            initial={editing || undefined}
            saving={save.isPending}
            serverError={save.error?.message}
            onSubmit={(body) => save.mutate(editing ? body : { ...body, teacherPublicId: d.publicId })}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}
