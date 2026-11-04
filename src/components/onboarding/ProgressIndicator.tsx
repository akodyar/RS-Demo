import React from 'react';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  type?: 'dots' | 'stepper';
  totalSteps: number;
  currentStep: number; // 1-indexed
  labels?: string[];
  className?: string;
  onStepClick?: (step: number) => void;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  type = 'dots',
  totalSteps,
  currentStep,
  labels = [],
  className = '',
  onStepClick,
}) => {
  if (type === 'stepper') {
    return (
      <div className={`w-full max-w-sm mx-auto px-2 ${className}`}>
        <div className="flex items-center justify-between relative">
          {/* Background connecting bar */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-800 -z-0" />
          {/* Active progress bar */}
          <div
            className="absolute top-4 start-4 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300 -z-0"
            style={{
              width: `${Math.max(0, Math.min(100, ((currentStep - 1) / (totalSteps - 1)) * 100))}%`,
            }}
          />

          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNumber = i + 1;
            const isCompleted = stepNumber < currentStep;
            const isActive = stepNumber === currentStep;

            return (
              <div
                key={i}
                className="flex flex-col items-center relative z-10"
                onClick={() => onStepClick && stepNumber <= currentStep && onStepClick(stepNumber)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isCompleted
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-xs'
                      : isActive
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black ring-4 ring-amber-500/20 shadow-md scale-105'
                      : 'bg-[#0c1322] border-2 border-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stepNumber}
                </div>
                {labels[i] && (
                  <span
                    className={`text-[11px] font-medium mt-1.5 whitespace-nowrap ${
                      isActive ? 'text-amber-400 font-bold' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {labels[i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Dots indicator matching master reference screens
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isActive = stepNumber === currentStep;
        return (
          <div
            key={i}
            className={`transition-all duration-200 rounded-full ${
              isActive
                ? 'w-2.5 h-2.5 bg-gradient-to-r from-amber-400 to-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                : 'w-2.5 h-2.5 bg-slate-800 border border-slate-700/60'
            }`}
          />
        );
      })}
    </div>
  );
};
