import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, refreshSession, onSessionEnded } from '../api/client';
import i18n from '../i18n';
import { disableWebPush } from '../utils/webPush';
import { resolveLoginLanguage, wasLanguageChosen } from '../i18n/preference';

export const AuthContext = createContext({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ admin: '/admin', teacher: '/teacher', student: '/student' }[role] || '/');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  const loadMe = useCallback(async () => {
    const me = await api.get('/auth/me');
    setUser(me.data);
    const { apply, save } = resolveLoginLanguage({ chosen: wasLanguageChosen(), account: me.data.preferredLang, current: i18n.language });
    if (apply) i18n.changeLanguage(apply);
    if (save) api.put('/account/language', { preferredLang: save }).catch(() => {});
    return me.data;
  }, []);

  useEffect(() => {
    let alive = true;
    refreshSession()
      .then(() => loadMe())
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    const off = onSessionEnded((err) => {
      setUser(null);
      if (err && err.message) setSessionMessage(err.message);
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadMe]);

  const login = useCallback(
    async (mobile, otp) => {
      const r = await api.post('/auth/login', { mobile, otp });
      setAccessToken(r.data.accessToken);
      setSessionMessage('');
      return loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      await disableWebPush();
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe: loadMe, sessionMessage, setUser }),
    [user, loading, login, logout, loadMe, sessionMessage],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
