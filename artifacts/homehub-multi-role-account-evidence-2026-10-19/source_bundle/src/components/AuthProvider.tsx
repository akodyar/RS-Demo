import React, { createContext, useContext, useEffect, useState } from 'react';
import { useInfrastructure } from './InfrastructureProvider';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  name?: string;
  roles?: string[];
  role?: string;
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  uid?: string;
  getIdToken?: () => Promise<string>;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<any>;
  signup: (data: {
    email: string;
    pass: string;
    fullName: string;
    phone?: string;
    role: string;
    entityType?: string;
    companyName?: string;
  }) => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
  setDevPersona?: (role: string, email?: string) => void;
  registerDevUser?: (data: { email: string; name: string; role: string; entityType?: string }) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isProductionEnv = import.meta.env?.MODE === 'production' || import.meta.env?.PROD;

  const [user, setUser] = useState<AuthUser | null>(() => {
    if (!isProductionEnv) {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('homehub_auth_persona') : null;
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    const stored = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'))
      : null;
    if (stored) return stored;
    if (!isProductionEnv) {
      const persona = typeof localStorage !== 'undefined' ? localStorage.getItem('homehub_auth_persona') : null;
      if (persona) {
        try {
          const parsed = JSON.parse(persona);
          return parsed.token || `dev-${(parsed.role || 'tenant').toLowerCase()}`;
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const infrastructure = useInfrastructure();

  // Authoritative session restoration on initial mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'))
        : null;

      if (!storedToken) {
        return;
      }

      // If in development with a mock persona token, session is already restored from localStorage
      if (!isProductionEnv && (storedToken === 'dev-platform_admin' || storedToken.startsWith('dev-'))) {
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const dbUser = data.user;
          const userWithHelpers: AuthUser = {
            ...dbUser,
            displayName: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
            name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
            role: (dbUser.roles && dbUser.roles[0]) || 'TENANT',
            getIdToken: async () => storedToken,
          };
          setUser(userWithHelpers);
          setToken(storedToken);
        } else {
          // Token is invalid or expired
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('homehub_auth_token');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('homehub_auth_persona');
          }
          setUser(null);
          setToken(null);
        }
      } catch (e) {
        console.warn('Session restoration error:', e);
      }
    };

    restoreSession();
  }, [isProductionEnv]);

  /**
   * Authoritative Native Login:
   * Verifies credentials directly against HomeHub PostgreSQL backend via Argon2id.
   */
  const login = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error('تکایە ئیمەیڵەکەت بنووسە (Email is required).');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error('ئیمەیڵەکە دروست نییە (Invalid email format).');
      }
      if (!pass) {
        throw new Error('تکایە وشەی نهێنی بنووسە (Password is required).');
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: pass,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('ئیمەیڵ یان وشەی نهێنی هەڵەیە (Invalid email or password).');
        }
        if (res.status === 403) {
          throw new Error('هەژمارەکەت ڕاگیراوە (Account Suspended). تکایە پەیوەندی بە پشتیوانییەوە بکە.');
        }
        if (res.status === 423) {
          throw new Error('هەژمارەکەت بە شێوەیەکی کاتی ڕاگیراوە بەهۆی هەوڵی زۆر. تکایە کەمێکی تر دووبارەی بکەرەوە.');
        }
        if (res.status === 429) {
          throw new Error('هەوڵی زۆر دراوە. تکایە کەمێکی تر دووبارەی بکەرەوە (Too many attempts).');
        }
        throw new Error(data.message || data.error || 'هەڵەیەک ڕوویدا لە کاتی چوونەژوورەوە.');
      }

      const { token: sessionToken, user: dbUser } = data;
      const userWithHelpers: AuthUser = {
        ...dbUser,
        displayName: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
        name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
        role: (dbUser.roles && dbUser.roles[0]) || 'TENANT',
        getIdToken: async () => sessionToken,
      };

      setUser(userWithHelpers);
      setToken(sessionToken);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('homehub_auth_token', sessionToken);
        localStorage.setItem('auth_token', sessionToken);
      }

      return dbUser;
    } catch (err: any) {
      // Fail closed: clear all sessions and local storage on failed login
      setUser(null);
      setToken(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('homehub_auth_persona');
        localStorage.removeItem('homehub_auth_token');
        localStorage.removeItem('auth_token');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authoritative Native Registration:
   * Creates application user and credentials directly in PostgreSQL via Argon2id.
   */
  const signup = async (data: {
    email: string;
    pass: string;
    fullName: string;
    phone?: string;
    role: string;
    entityType?: string;
    companyName?: string;
  }) => {
    setError(null);
    setLoading(true);
    try {
      const trimmedEmail = data.email.trim();
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error('ئیمەیڵەکە دروست نییە (Invalid email format).');
      }
      if (!data.pass || data.pass.length < 6) {
        throw new Error('وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت (Password must be at least 6 characters).');
      }
      if (!data.fullName.trim()) {
        throw new Error('ناوی تەواو پێویستە (Full name is required).');
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: data.pass,
          fullName: data.fullName,
          phone: data.phone,
          role: data.role,
          entityType: data.entityType,
          companyName: data.companyName,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('ئەم ئیمەیڵە پێشتر تۆمارکراوە (Email already registered).');
        }
        throw new Error(resData.message || resData.error || 'نەتوانرا هەژمار دروست بکرێت.');
      }

      const { token: sessionToken, user: dbUser } = resData;
      const userWithHelpers: AuthUser = {
        ...dbUser,
        displayName: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
        name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email,
        role: (dbUser.roles && dbUser.roles[0]) || 'TENANT',
        getIdToken: async () => sessionToken,
      };

      setUser(userWithHelpers);
      setToken(sessionToken);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('homehub_auth_token', sessionToken);
        localStorage.setItem('auth_token', sessionToken);
      }

      return dbUser;
    } catch (err: any) {
      setUser(null);
      setToken(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Password Reset Request
   */
  const resetPassword = async (emailStr: string) => {
    const trimmed = emailStr.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error('تکایە ئیمەیڵێکی دروست بنووسە.');
    }
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
  };

  /**
   * Development Persona (strictly guarded against production execution)
   */
  const setDevPersona = (role: string, emailStr?: string) => {
    if (isProductionEnv) {
      throw new Error('MOCK_AUTH_FORBIDDEN_IN_PRODUCTION: Mock personas are forbidden in production.');
    }
    const roleUpper = role.toUpperCase();
    const tokenMap: Record<string, string> = {
      PLATFORM_ADMIN: 'dev-admin',
      SUPER_ADMIN: 'dev-super-admin',
      ADMIN: 'dev-admin',
      PROPERTY_OWNER: 'dev-owner',
      OWNER: 'dev-owner',
      COMPANY_ADMIN: 'dev-company',
      COMPANY: 'dev-company',
      TENANT: 'dev-tenant',
      AGENT: 'dev-agent',
      AGENT_BROKER: 'dev-agent',
      BUYER: 'dev-buyer',
      VENDOR: 'dev-vendor',
      EXPLORE: 'guest',
      GUEST: 'guest',
    };
    const devToken = tokenMap[roleUpper] || `dev-${role.toLowerCase()}`;
    const email = emailStr || `${role.toLowerCase()}@homehub.iq`;

    const nameMap: Record<string, string> = {
      PLATFORM_ADMIN: 'Platform Admin',
      SUPER_ADMIN: 'Platform Super Admin',
      ADMIN: 'Platform Admin',
      PROPERTY_OWNER: 'Salar Aziz',
      OWNER: 'Salar Aziz',
      COMPANY_ADMIN: 'Zagros Real Estate',
      COMPANY: 'Zagros Real Estate',
      TENANT: 'Ahmed Farhad',
      AGENT: 'Ahmed Rahman',
      AGENT_BROKER: 'Ahmed Rahman',
      BUYER: 'Zana Mustafa',
      VENDOR: 'Erbil Quick Fix Services',
      GUEST: 'Guest User',
      EXPLORE: 'Guest User',
    };

    const displayName = nameMap[roleUpper] || role.replace('_', ' ');

    const fakeUser = {
      id: `dev-${role.toLowerCase()}-${Date.now()}`,
      uid: `dev-${role.toLowerCase()}-${Date.now()}`,
      email,
      displayName,
      name: displayName,
      role: roleUpper,
      roles: [roleUpper],
      token: devToken,
      getIdToken: async () => devToken,
    } as any;

    setUser(fakeUser);
    setToken(devToken);
    localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
    localStorage.setItem('homehub_auth_token', devToken);
    localStorage.setItem('auth_token', devToken);
  };

  /**
   * Development User Registration (strictly guarded against production execution)
   */
  const registerDevUser = (data: { email: string; name: string; role: string; entityType?: string }) => {
    if (isProductionEnv) {
      throw new Error('MOCK_AUTH_FORBIDDEN_IN_PRODUCTION: Mock registration is forbidden in production.');
    }
    const roleUpper = data.role.toUpperCase();
    const uid = `dev-new-${Date.now()}`;
    const payloadStr = JSON.stringify({ uid, email: data.email, name: data.name, role: roleUpper });
    const payload = btoa(encodeURIComponent(payloadStr).replace(/%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode(parseInt(p1, 16))
    ));
    const devToken = `dev-register-${payload}`;

    const fakeUser = {
      id: uid,
      uid,
      email: data.email,
      displayName: data.name,
      name: data.name,
      role: roleUpper,
      roles: [roleUpper],
      token: devToken,
      getIdToken: async () => devToken,
    } as any;

    setUser(fakeUser);
    setToken(devToken);
    localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
    localStorage.setItem('homehub_auth_token', devToken);
    localStorage.setItem('auth_token', devToken);
  };

  /**
   * Authoritative Logout (Server-Side Session Invalidation & Client State Clearance)
   */
  const logout = async () => {
    try {
      const storedToken = token || (typeof localStorage !== 'undefined'
        ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'))
        : null);
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
    } catch {
      // Safe ignore
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('homehub_auth_persona');
      localStorage.removeItem('homehub_auth_token');
      localStorage.removeItem('auth_token');
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        signup,
        resetPassword,
        logout,
        token,
        setDevPersona,
        registerDevUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
