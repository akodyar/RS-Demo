import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingShell } from './OnboardingShell';
import { Screen1Welcome } from './Screen1Welcome';
import { Screen2Capabilities } from './Screen2Capabilities';
import { Screen3Purpose, ROLE_DEFINITIONS } from './Screen3Purpose';
import { Screen4Signup } from './Screen4Signup';
import { Screen5Verification } from './Screen5Verification';
import { Screen6RoleConfirmation } from './Screen6RoleConfirmation';
import { Screen7ProfileSetup } from './Screen7ProfileSetup';
import { Screen8ProfileReview } from './Screen8ProfileReview';
import { Screen9Success } from './Screen9Success';
import { ScreenLogin } from './ScreenLogin';
import { useAuth } from '../AuthProvider';
import { RoleItem } from './OnboardingCards';

export type OnboardingStep =
  | 'welcome'
  | 'capabilities'
  | 'purpose'
  | 'signup'
  | 'verification'
  | 'role_confirm'
  | 'profile_setup'
  | 'profile_review'
  | 'success'
  | 'login';

interface OnboardingWorkflowProps {
  initialStep?: OnboardingStep;
  onComplete?: (roleKey: string) => void;
}

export const OnboardingWorkflow: React.FC<OnboardingWorkflowProps> = ({
  initialStep = 'welcome',
  onComplete,
}) => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [selectedConfirmRoleId, setSelectedConfirmRoleId] = useState<string>('');
  const [returnStep, setReturnStep] = useState<OnboardingStep>(initialStep === 'login' ? 'login' : 'welcome');
  const [socialNotice, setSocialNotice] = useState<string>('');

  useEffect(() => {
    if (initialStep === 'verification') {
      setCurrentStep('profile_setup');
      return;
    }
    setCurrentStep(initialStep);
    if (initialStep === 'login') {
      setSelectedRole(null);
      setSelectedConfirmRoleId('');
      setReturnStep('login');
    } else if (initialStep === 'welcome') {
      setSelectedRole(null);
      setSelectedConfirmRoleId('');
      setReturnStep('welcome');
    } else if (initialStep === 'purpose') {
      setSelectedRole(null);
      setSelectedConfirmRoleId('');
    }
  }, [initialStep]);

  useEffect(() => {
    if (currentStep === 'signup' && !selectedRole) {
      setCurrentStep('purpose');
    }
  }, [currentStep, selectedRole]);

  const handleStartRegistrationFromLogin = () => {
    setSelectedRole(null);
    setSelectedConfirmRoleId('');
    setReturnStep('login');
    setCurrentStep('purpose');
    try {
      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        navigate('/onboarding/purpose');
      }
    } catch {}
  };

  const [signupData, setSignupData] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    entityType: 'INDIVIDUAL',
    consentAccepted: true,
  });

  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: 'هەولێر',
    preferredLanguage: 'ku',
    preferredCurrency: 'IQD',
    avatarUrl: '',
    termsAccepted: true,
  });

  // Authoritative role workspace resolver
  const getDestinationForRole = (roleKey?: string): string => {
    const role = (roleKey || selectedRole?.roleKey || 'OWNER').toUpperCase();
    switch (role) {
      case 'OWNER':
      case 'PROPERTY_OWNER':
      case 'COMPANY':
      case 'COMPANY_ADMIN':
      case 'COMPANY_OWNER':
        return '/owner';
      case 'TENANT':
        return '/tenant';
      case 'BUYER':
        return '/buyer';
      case 'AGENT':
      case 'BROKER':
        return '/agent';
      case 'VENDOR':
        return '/vendor';
      case 'ADMIN':
      case 'PLATFORM_ADMIN':
      case 'SUPER_ADMIN':
      case 'FINANCE_ADMIN':
      case 'SUPPORT_ADMIN':
      case 'READ_ONLY_ADMIN':
        return '/admin/dashboard';
      case 'GUEST':
      case 'EXPLORE':
        return '/search';
      default:
        return '/';
    }
  };

  const navigateByRole = (roleKey?: string, overrideDestination?: string) => {
    const destination = overrideDestination || getDestinationForRole(roleKey);
    const role = (roleKey || selectedRole?.roleKey || 'OWNER').toUpperCase();
    if (onComplete) {
      onComplete(role);
    } else {
      navigate(destination);
    }
  };

  // Perform authoritative sign-in
  const handleLoginSubmit = async (email: string, pass: string, quickRole?: string) => {
    // If an explicit developer test persona was clicked in dev mode:
    if (quickRole && import.meta.env?.MODE !== 'production' && !import.meta.env?.PROD) {
      if (auth && (auth as any).setDevPersona) {
        (auth as any).setDevPersona(quickRole, email);
      }
      navigateByRole(quickRole);
      return;
    }

    // Authoritative credential verification via identity provider:
    if (!auth || !auth.login) {
      throw new Error('خزمەتگوزاری ناسنامە چالاک نەکراوە (Identity Provider NOT_CONFIGURED).');
    }

    const dbUser = await auth.login(email, pass);
    const userRole = (dbUser?.roles && dbUser.roles[0]) || 'TENANT';
    navigateByRole(userRole);
  };

  // Render Step
  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <Screen1Welcome
            onStart={() => {
              setSelectedRole(null);
              setSelectedConfirmRoleId('');
              setReturnStep('welcome');
              setCurrentStep('purpose');
              try {
                if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/onboarding') || window.location.pathname === '/welcome')) {
                  navigate('/onboarding/purpose');
                }
              } catch {}
            }}
            onLoginClick={() => {
              setReturnStep('welcome');
              setCurrentStep('login');
              try {
                if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/onboarding') || window.location.pathname === '/welcome')) {
                  navigate('/login');
                }
              } catch {}
            }}
            onSelectCategory={(catId) => {
              if (catId === 'rent') {
                const tenantRole = ROLE_DEFINITIONS.find((r) => r.id === 'tenant') || ROLE_DEFINITIONS[1];
                setSelectedRole(tenantRole);
                setSelectedConfirmRoleId('tenant');
              } else if (catId === 'services') {
                const vendorRole = ROLE_DEFINITIONS.find((r) => r.id === 'vendor') || ROLE_DEFINITIONS[3];
                setSelectedRole(vendorRole);
                setSelectedConfirmRoleId('vendor');
              }
              setReturnStep('welcome');
              setCurrentStep('purpose');
              try {
                if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/onboarding') || window.location.pathname === '/welcome')) {
                  navigate('/onboarding/purpose');
                }
              } catch {}
            }}
          />
        );

      case 'capabilities':
      case 'purpose':
        return (
          <Screen3Purpose
            selectedRole={selectedRole ? selectedRole.id : ''}
            onSelectRole={(role) => {
              setSelectedRole(role);
              setSelectedConfirmRoleId(role.id);
            }}
            onContinue={() => {
              if (!selectedRole) return;
              if (selectedRole.id === 'explore' || (selectedRole as any).roleKey === 'EXPLORE') {
                navigateByRole('GUEST');
              } else {
                setCurrentStep('signup');
                try {
                  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/onboarding') || window.location.pathname === '/login')) {
                    navigate('/onboarding/signup');
                  }
                } catch {}
              }
            }}
            onGuestSearch={() => navigateByRole('GUEST')}
            onBack={() => {
              const backTarget = returnStep || 'welcome';
              setCurrentStep(backTarget);
              if (backTarget === 'login') {
                try {
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')) {
                    navigate('/login');
                  }
                } catch {}
              }
            }}
          />
        );

      case 'signup':
        if (!selectedRole) {
          return (
            <Screen3Purpose
              selectedRole=""
              onSelectRole={(role) => {
                setSelectedRole(role);
                setSelectedConfirmRoleId(role.id);
              }}
              onContinue={() => {
                setCurrentStep('signup');
              }}
              onGuestSearch={() => navigateByRole('GUEST')}
              onBack={() => {
                const backTarget = returnStep || 'welcome';
                setCurrentStep(backTarget);
                if (backTarget === 'login') {
                  try {
                    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')) {
                      navigate('/login');
                    }
                  } catch {}
                }
              }}
            />
          );
        }
        return (
          <Screen4Signup
            selectedRole={selectedRole}
            formData={signupData}
            onUpdateFormData={(patch) =>
              setSignupData((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={async () => {
              const role = (selectedRole?.roleKey || 'OWNER').toUpperCase();
              if (auth && auth.signup) {
                await auth.signup({
                  email: signupData.email,
                  pass: signupData.password,
                  fullName: signupData.fullName,
                  phone: signupData.phone,
                  role,
                  entityType: signupData.entityType,
                  companyName: signupData.companyName || `${signupData.fullName}'s Real Estate`,
                });
              }
              setProfileData((prev) => ({
                ...prev,
                fullName: signupData.fullName,
                email: signupData.email || prev.email,
                phone: signupData.phone,
              }));
              setCurrentStep('profile_setup');
              try {
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')) {
                  navigate('/onboarding/profile');
                }
              } catch {}
            }}
            onBack={() => {
              setCurrentStep('purpose');
              try {
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')) {
                  navigate('/onboarding/purpose');
                }
              } catch {}
            }}
            onLoginClick={() => {
              setSelectedRole(null);
              setSelectedConfirmRoleId('');
              setReturnStep('login');
              setCurrentStep('login');
              try {
                if (typeof window !== 'undefined' && window.location.pathname.startsWith('/onboarding')) {
                  navigate('/login');
                }
              } catch {}
            }}
            socialNotice={socialNotice}
            onSocialNotice={setSocialNotice}
          />
        );

      case 'verification':
        return (
          <Screen5Verification
            contactInfo={signupData.email || `+964 ${signupData.phone}`}
            onVerify={(_code) => setCurrentStep('profile_setup')}
            onBack={() => setCurrentStep('signup')}
            onChangeContact={() => setCurrentStep('signup')}
          />
        );

      case 'role_confirm':
        return (
          <Screen6RoleConfirmation
            selectedRoleId={selectedConfirmRoleId || selectedRole?.id || 'owner'}
            onSelectRole={(id) => {
              setSelectedConfirmRoleId(id);
              const found = ROLE_DEFINITIONS.find((r) => r.id === id);
              if (found) setSelectedRole(found);
            }}
            onContinue={() => {
              if (selectedConfirmRoleId === 'explore') {
                navigateByRole('GUEST');
              } else {
                setCurrentStep('profile_setup');
              }
            }}
            onBack={() => setCurrentStep('signup')}
            onSkip={() => navigateByRole('GUEST')}
          />
        );

      case 'profile_setup':
        return (
          <Screen7ProfileSetup
            profileData={profileData}
            onUpdateProfile={(patch) =>
              setProfileData((prev) => ({ ...prev, ...patch }))
            }
            onContinue={() => setCurrentStep('profile_review')}
            onBack={() => setCurrentStep('signup')}
          />
        );

      case 'profile_review':
        return (
          <Screen8ProfileReview
            roleInfo={{
              title: selectedRole?.title || 'خاوەنی موڵک',
              imageUrl: selectedRole?.imageUrl || ROLE_DEFINITIONS[0].imageUrl,
            }}
            userData={profileData}
            onEditRole={() => setCurrentStep('role_confirm')}
            onFinish={() => setCurrentStep('success')}
            onBack={() => setCurrentStep('profile_setup')}
          />
        );

      case 'success':
        return (
          <Screen9Success
            roleKey={selectedRole?.roleKey || 'OWNER'}
            onEnterApp={() => navigateByRole(selectedRole?.roleKey)}
            onLater={() => navigateByRole(selectedRole?.roleKey)}
            onActionClick={(actionId) => {
              if (actionId === 'manage') {
                navigateByRole(selectedRole?.roleKey, '/owner');
              } else if (actionId === 'search') {
                navigateByRole(selectedRole?.roleKey, '/rentals');
              } else {
                navigateByRole(selectedRole?.roleKey);
              }
            }}
          />
        );

      case 'login':
        return (
          <ScreenLogin
            onLogin={handleLoginSubmit}
            onGoToSignup={handleStartRegistrationFromLogin}
            initialEmail={signupData.email}
          />
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingShell
      bgDark={currentStep === 'welcome'}
      currentScreenNumber={
        currentStep === 'welcome'
          ? 1
          : currentStep === 'purpose' || currentStep === 'capabilities'
          ? 2
          : currentStep === 'signup'
          ? 3
          : currentStep === 'profile_setup'
          ? 4
          : currentStep === 'profile_review'
          ? 5
          : currentStep === 'success'
          ? 6
          : 0
      }
      onNavigateScreen={(step) => setCurrentStep(step)}
    >
      {renderStep()}
    </OnboardingShell>
  );
};
