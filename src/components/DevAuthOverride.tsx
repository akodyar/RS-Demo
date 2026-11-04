import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { Building2, UserCircle, Code2, AlertTriangle } from 'lucide-react';
import { useInfrastructure } from './InfrastructureProvider';
import { useI18n } from '../i18n/I18nProvider';

// We need to access the AuthContext to override it. 
// However, it's not exported from AuthProvider.tsx. 
// We will modify AuthProvider.tsx to export AuthContext.
import { AuthContext } from './AuthProvider'; 

export const DevAuthOverride: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { error } = useAuth();
  const { t } = useI18n();
  const infrastructure = useInfrastructure();
  const [activePersona, setActivePersona] = useState<string | null>(null);

  // CRITICAL: DevAuthOverride is strictly disabled in production builds
  if (import.meta.env.PROD) {
    return <>{children}</>;
  }

  // ONLY allow this in development when Firebase is not configured
  const isDevModeAllowed = error === "Identity Provider NOT_CONFIGURED" || infrastructure.database === "DATABASE_NOT_CONFIGURED";

  if (!isDevModeAllowed) {
    return <>{children}</>;
  }

  const personaTokenMap: Record<string, string> = {
    PLATFORM_ADMIN: 'dev-admin',
    PROPERTY_OWNER: 'dev-owner',
    COMPANY_ADMIN: 'dev-company',
    TENANT: 'dev-tenant',
    BUYER: 'dev-buyer',
    VENDOR: 'dev-vendor',
  };

  useEffect(() => {
    if (activePersona) {
      const devToken = personaTokenMap[activePersona] || 'dev-super-admin';
      localStorage.setItem('auth_token', devToken);
    } else {
      localStorage.removeItem('auth_token');
    }
  }, [activePersona]);

  if (activePersona) {
    const devToken = personaTokenMap[activePersona] || 'dev-super-admin';
    const fakeUser = {
      uid: `dev-mock-${activePersona.toLowerCase()}`,
      email: `${activePersona.toLowerCase()}@example.com`,
      displayName: `Dev ${activePersona}`,
      getIdToken: async () => devToken,
    } as any;

    return (
      <AuthContext.Provider value={{
        user: fakeUser,
        loading: false,
        error: null,
        logout: async () => setActivePersona(null),
        token: devToken,
        isDevOverride: true,
        devRole: activePersona
      } as any}>
        <div className="relative">
          <div className="fixed bottom-4 right-4 z-50 bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer" onClick={() => setActivePersona(null)}>
            <Code2 className="w-4 h-4" />
            Dev Persona: {activePersona} (Click to reset)
          </div>
          {children}
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        <div className="p-6 text-center border-b border-slate-700">
          <Code2 className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t('Isolated Development Mode', 'Isolated Development Mode')}</h2>
          <p className="text-sm text-slate-400">
            {t('Authentication is not configured. Select a test persona to view the UI.', 'Authentication is not configured. Select a test persona to view the UI.')}
          </p>
        </div>
        <div className="p-4 space-y-3">
          <PersonaButton title={t('role.admin', 'Platform Admin')} role="PLATFORM_ADMIN" onClick={() => setActivePersona('PLATFORM_ADMIN')} />
          <PersonaButton title={t('role.owner', 'Property Owner')} role="PROPERTY_OWNER" onClick={() => setActivePersona('PROPERTY_OWNER')} />
          <PersonaButton title={t('role.company', 'Real Estate Company')} role="COMPANY_ADMIN" onClick={() => setActivePersona('COMPANY_ADMIN')} />
          <PersonaButton title={t('role.tenant', 'Tenant')} role="TENANT" onClick={() => setActivePersona('TENANT')} />
          <PersonaButton title={t('role.buyer', 'Buyer')} role="BUYER" onClick={() => setActivePersona('BUYER')} />
          <PersonaButton title={t('role.vendor', 'Service Vendor')} role="VENDOR" onClick={() => setActivePersona('VENDOR')} />
        </div>
      </div>
    </div>
  );
};

const PersonaButton = ({ title, role, onClick }: { title: string, role: string, onClick: () => void }) => {
  const { t } = useI18n();
  return (
    <button 
      onClick={onClick}
      className="w-full text-left bg-slate-700 hover:bg-slate-600 transition-colors p-4 rounded-lg flex items-center gap-3 border border-slate-600"
    >
      <UserCircle className="w-6 h-6 text-amber-400" />
      <div>
        <div className="font-bold text-white">{title}</div>
        <div className="text-xs text-slate-400">{t('Role:', 'Role:')} {role}</div>
      </div>
    </button>
  );
};
