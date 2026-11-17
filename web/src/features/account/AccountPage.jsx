import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, setAccessToken } from '../../api/client';
import { useAuth } from '../../app/AuthProvider';
import { Button, Card, Input, Modal, OtpInput, PageHeader, useToast, Banner } from '../../components';
import { isValidMobile } from '../../utils/format';
import { LanguageSwitcher } from '../../app/layouts/LanguageSwitcher';

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, refreshMe, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [newMobile, setNewMobile] = useState('');
  const [changeStep, setChangeStep] = useState('enter');
  const [changeCode, setChangeCode] = useState('');
  const [changeError, setChangeError] = useState('');
  const [busy, setBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSent, setDeleteSent] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const startChange = async (e) => {
    e.preventDefault();
    if (!isValidMobile(newMobile)) {
      setChangeError(t('auth.invalidMobile'));
      return;
    }
    setBusy(true);
    setChangeError('');
    try {
      await api.post('/account/change-mobile/start', { newMobile });
      setChangeStep('otp');
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmChange = async (e) => {
    e.preventDefault();
    setBusy(true);
    setChangeError('');
    try {
      await api.post('/account/change-mobile/confirm', { newMobile, otp: changeCode });
      toast.show({ message: t('account.changed') });
      setChangeStep('enter');
      setNewMobile('');
      setChangeCode('');
      await refreshMe();
    } catch (err) {
      setChangeError(err.message);
      setChangeCode('');
    } finally {
      setBusy(false);
    }
  };

  const sendDeleteOtp = async () => {
    setDeleteError('');
    try {
      await api.post('/auth/otp/send', { mobile: user.mobile, purpose: 'delete_account' });
      setDeleteSent(true);
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setDeleteError('');
    try {
      await api.post('/account/delete', { otp: deleteCode });
      setAccessToken(null);
      setUser(null);
      navigate('/', { replace: true, state: { message: t('account.deleted') } });
    } catch (err) {
      setDeleteError(err.message);
      setDeleteCode('');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  return (
    <div className="stack">
      <PageHeader title={t('account.title')} subtitle={`${user.name} · ${user.mobile}`} />
      <Card title={t('account.language')}>
        <LanguageSwitcher />
      </Card>
      <Card title={t('account.changeMobile')}>
        <p className="muted">{t('account.changeMobileIntro')}</p>
        {changeStep === 'enter' ? (
          <form onSubmit={startChange} noValidate>
            <Input label={t('account.newMobile')} type="tel" inputMode="numeric" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} error={changeError} />
            <Button type="submit" variant="compact" loading={busy}>{t('account.sendOtp')}</Button>
          </form>
        ) : (
          <form onSubmit={confirmChange} className="stack" noValidate>
            <p>{t('auth.otpSentTo', { mobile: newMobile })}</p>
            <OtpInput value={changeCode} onChange={setChangeCode} autoFocus />
            {changeError && <p className="field__error" role="alert">{changeError}</p>}
            <div className="row">
              <Button type="submit" loading={busy} disabled={changeCode.length !== 6}>{t('account.confirmChange')}</Button>
              <Button variant="ghost" onClick={() => { setChangeStep('enter'); setChangeCode(''); }}>{t('common.cancel')}</Button>
            </div>
          </form>
        )}
      </Card>
      <Card title={t('account.deleteTitle')}>
        <p>{t('account.deleteIntro')}</p>
        <Button variant="danger" onClick={() => { setDeleteOpen(true); setDeleteSent(false); setDeleteCode(''); setDeleteError(''); }}>
          {t('account.deleteButton')}
        </Button>
      </Card>
      <p className="row">
        <Link to="/privacy">{t('account.privacy')}</Link>
        <Link to="/terms">{t('account.terms')}</Link>
      </p>
      <Modal
        open={deleteOpen}
        title={t('account.deleteTitle')}
        onClose={() => setDeleteOpen(false)}
        footer={
          deleteSent ? (
            <>
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="danger" loading={busy} disabled={deleteCode.length !== 6} onClick={confirmDelete}>{t('account.deleteButton')}</Button>
            </>
          ) : (
            <Button variant="compact" onClick={sendDeleteOtp}>{t('account.sendDeleteOtp')}</Button>
          )
        }
      >
        <p>{t('account.deleteIntro')}</p>
        {deleteSent && (
          <div className="stack">
            <p>{t('account.deleteConfirm', { mobile: user.mobile })}</p>
            <OtpInput value={deleteCode} onChange={setDeleteCode} autoFocus />
          </div>
        )}
        {deleteError && <Banner kind="error" message={deleteError} />}
      </Modal>
    </div>
  );
}
