import React, { createContext, useContext, useEffect, useState } from 'react';

interface InfrastructureState {
  status: 'LOADING' | 'READY' | 'DEGRADED' | 'NOT_CONFIGURED';
  database: 'DATABASE_CONNECTED' | 'DATABASE_NOT_CONFIGURED' | 'DATABASE_UNAVAILABLE' | 'DATABASE_CONFIGURATION_ERROR';
  auth: 'AUTH_CONFIGURED' | 'AUTH_NOT_CONFIGURED';
  lastChecked: string | null;
}

const InfrastructureContext = createContext<InfrastructureState | null>(null);

export const InfrastructureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<InfrastructureState>({
    status: 'LOADING',
    database: 'DATABASE_NOT_CONFIGURED',
    auth: 'AUTH_NOT_CONFIGURED',
    lastChecked: null,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setState({
            status: data.database === 'DATABASE_CONNECTED' ? 'READY' : 'DEGRADED',
            database: data.database,
            auth: 'AUTH_NOT_CONFIGURED', // Will update later when auth health is added
            lastChecked: new Date().toISOString()
          });
        }
      } catch (e) {
        setState({
          status: 'NOT_CONFIGURED',
          database: 'DATABASE_UNAVAILABLE',
          auth: 'AUTH_NOT_CONFIGURED',
          lastChecked: new Date().toISOString()
        });
      }
    };
    checkHealth();
  }, []);

  return (
    <InfrastructureContext.Provider value={state}>
      {children}
    </InfrastructureContext.Provider>
  );
};

export const useInfrastructure = () => {
  const context = useContext(InfrastructureContext);
  if (!context) throw new Error("useInfrastructure must be used within InfrastructureProvider");
  return context;
};
