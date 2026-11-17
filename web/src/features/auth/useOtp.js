import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Sends an OTP for a purpose and tracks the resend countdown.
export function useOtp(purpose) {
  const [sentTo, setSentTo] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const send = async (mobile) => {
    setSending(true);
    setError('');
    try {
      const r = await api.post('/auth/otp/send', { mobile, purpose });
      setSentTo(mobile);
      setSecondsLeft(r.data.resendAfterSec || 30);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  return { send, sentTo, secondsLeft, sending, error, setError, reset: () => setSentTo('') };
}
