import React from 'react';
import { useAuth } from './AuthProvider';
import { LoginPage } from '../pages/LoginPage';
import { Loader2 } from 'lucide-react';
import { DevAuthOverride } from './DevAuthOverride';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b14]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // If we don't have a user, show the authentic HomeHub onboarding and login experience
  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
};
