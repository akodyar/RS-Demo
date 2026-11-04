import React, { Suspense } from 'react';

const OnboardingWorkflow = React.lazy(() =>
  import('../components/onboarding/OnboardingWorkflow').then((m) => ({ default: m.OnboardingWorkflow }))
);

export const LoginPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14]" />}>
      <OnboardingWorkflow initialStep="login" />
    </Suspense>
  );
};

