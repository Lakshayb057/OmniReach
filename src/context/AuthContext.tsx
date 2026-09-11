import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'operator';
  company_name?: string;
  permissions: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  isLoading: boolean;
  isWorkingOrProcessing: boolean;
  login: (token: string, user: User) => void;
  logout: (reason?: 'manual' | 'inactivity' | 'expired') => void;
  reportActiveWork: () => void;
  setIsWorkingOrProcessing: (working: boolean) => void;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Threshold
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const setAuthCookies = (authToken: string) => {
  const maxAge = 15 * 60; // 15 minutes in seconds
  document.cookie = `auth_token=${authToken}; max-age=${maxAge}; path=/; SameSite=Lax`;
  document.cookie = `session_active=1; max-age=${maxAge}; path=/; SameSite=Lax`;
};

const clearAuthCookies = () => {
  document.cookie = 'auth_token=; max-age=0; path=/; SameSite=Lax';
  document.cookie = 'session_active=; max-age=0; path=/; SameSite=Lax';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWorkingOrProcessing, setIsWorkingOrProcessingState] = useState<boolean>(false);

  const isWorkingRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const throttleActivityTimerRef = useRef<number | null>(null);

  const setIsWorkingOrProcessing = useCallback((working: boolean) => {
    isWorkingRef.current = working;
    setIsWorkingOrProcessingState(working);
    if (working) {
      // Refresh activity timer when active work starts
      lastActivityRef.current = Date.now();
      localStorage.setItem('last_activity', String(Date.now()));
    }
  }, []);

  const reportActiveWork = useCallback(() => {
    lastActivityRef.current = Date.now();
    localStorage.setItem('last_activity', String(Date.now()));
  }, []);

  // 1. Initial Session Restoration
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setAuthCookies(token);
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        lastActivityRef.current = Date.now();
        localStorage.setItem('last_activity', String(Date.now()));
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      logout('expired');
    } finally {
      setIsLoading(false);
    }
  };

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('last_activity', String(Date.now()));
    setAuthCookies(newToken);
    setToken(newToken);
    setUser(newUser);
    lastActivityRef.current = Date.now();
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = useCallback((reason: 'manual' | 'inactivity' | 'expired' = 'manual') => {
    localStorage.removeItem('token');
    localStorage.removeItem('last_activity');
    clearAuthCookies();
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);

    // Call server to clear HTTP-only cookies and log audit
    axios.post('/api/auth/logout').catch(() => {});

    if (reason === 'inactivity') {
      window.location.href = '/login?reason=inactivity';
    } else if (reason === 'expired') {
      window.location.href = '/login?reason=expired';
    }
  }, []);

  // 2. Global User Activity Detection (Resets 15-min countdown on interaction)
  useEffect(() => {
    if (!user) return;

    const handleUserActivity = () => {
      // Throttle localStorage writes to at most once every 5 seconds
      if (!throttleActivityTimerRef.current) {
        lastActivityRef.current = Date.now();
        localStorage.setItem('last_activity', String(Date.now()));

        throttleActivityTimerRef.current = window.setTimeout(() => {
          throttleActivityTimerRef.current = null;
        }, 5000);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      if (throttleActivityTimerRef.current) {
        clearTimeout(throttleActivityTimerRef.current);
      }
    };
  }, [user]);

  // 3. Inactivity Checker (Checks every 10 seconds for 15-minute idle timeout)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // If software is under active processing (e.g. blast running, CSV parsing), keep session alive
      if (isWorkingRef.current) {
        lastActivityRef.current = Date.now();
        localStorage.setItem('last_activity', String(Date.now()));
        return;
      }

      // Check both local memory and localStorage (multi-tab sync)
      const storedLastActivity = Number(localStorage.getItem('last_activity') || lastActivityRef.current);
      const effectiveLastActivity = Math.max(lastActivityRef.current, storedLastActivity);
      const idleTime = Date.now() - effectiveLastActivity;

      if (idleTime >= SESSION_TIMEOUT_MS) {
        console.warn('Session expired due to 15 minutes of inactivity.');
        logout('inactivity');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user, logout]);

  // 4. Axios Interceptor for Automatic 401 Session Expiry Catch
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401 && user) {
          logout('expired');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isSuperadmin: user?.role === 'superadmin',
        isLoading,
        isWorkingOrProcessing,
        login,
        logout,
        reportActiveWork,
        setIsWorkingOrProcessing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
