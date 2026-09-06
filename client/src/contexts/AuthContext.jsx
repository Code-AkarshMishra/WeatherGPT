import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  // Store token in ref for interceptor access without re-render
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  // Set token on api instance
  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      localStorage.setItem('accessToken', accessToken);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('accessToken');
    }
  }, [accessToken]);

  // Auto-fetch current user on mount
  useEffect(() => {
    const init = async () => {
      if (!accessToken) { setLoading(false); return; }
      try {
        const res = await api.get('/api/auth/me');
        setUser(res.data.data.user);
      } catch {
        // Token invalid or expired — try refresh
        await tryRefresh();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line

  const tryRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) { setAccessToken(null); setUser(null); return; }
    try {
      const res = await api.post('/api/auth/refresh', { refreshToken });
      const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;
      setAccessToken(newAccess);
      localStorage.setItem('refreshToken', newRefresh);
      const meRes = await api.get('/api/auth/me');
      setUser(meRes.data.data.user);
    } catch {
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('refreshToken');
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { user: u, accessToken: at, refreshToken: rt } = res.data.data;
    setUser(u);
    setAccessToken(at);
    localStorage.setItem('refreshToken', rt);
    return u;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    const { user: u, accessToken: at, refreshToken: rt } = res.data.data;
    setUser(u);
    setAccessToken(at);
    localStorage.setItem('refreshToken', rt);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/api/auth/logout', { refreshToken });
    } catch { /* best effort */ }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, tryRefresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
