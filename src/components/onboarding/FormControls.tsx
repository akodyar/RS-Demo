import React, { useState, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  Building2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

// --- Primary CTA Button (Champagne Gold VIP Accent) ---
interface PrimaryCTAProps {
  id?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  showArrow?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({
  id,
  onClick,
  disabled = false,
  loading = false,
  children,
  showArrow = true,
  className = '',
  type = 'button',
}) => {
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full h-13 sm:h-14 rounded-full bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59b27] hover:from-[#e5c158] hover:to-[#d4af37] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-base flex items-center justify-between px-6 shadow-lg shadow-amber-950/40 transition-all duration-200 cursor-pointer ${className}`}
    >
      <div className="w-5" />
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-950" />
      ) : (
        <span className="text-[16px] tracking-wide font-black">{children}</span>
      )}
      {showArrow ? (
        <ArrowRight className="w-5 h-5 text-slate-950 stroke-[3] shrink-0" />
      ) : (
        <div className="w-5" />
      )}
    </button>
  );
};

// --- Secondary Action Button / Link ---
interface SecondaryActionProps {
  id?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'button' | 'link';
}

export const SecondaryAction: React.FC<SecondaryActionProps> = ({
  id,
  onClick,
  children,
  className = '',
  variant = 'button',
}) => {
  if (variant === 'link') {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        className={`text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`w-full h-12 rounded-2xl bg-[#111b2e] hover:bg-[#17243a] text-slate-200 border border-slate-700/80 hover:border-amber-500/30 font-semibold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer active:scale-[0.99] ${className}`}
    >
      {children}
    </button>
  );
};

// --- Standard Text Form Field ---
interface FormFieldProps {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  icon?: 'user' | 'mail' | 'lock' | 'phone' | 'building';
  required?: boolean;
  error?: string;
  dir?: 'ltr' | 'rtl';
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon,
  required = false,
  error,
  dir,
  className = '',
}) => {
  const { direction } = useI18n();

  const getIcon = () => {
    const iconClass = 'w-5 h-5 text-slate-400 shrink-0';
    switch (icon) {
      case 'user':
        return <User className={iconClass} />;
      case 'mail':
        return <Mail className={iconClass} />;
      case 'lock':
        return <Lock className={iconClass} />;
      case 'phone':
        return <Phone className={iconClass} />;
      case 'building':
        return <Building2 className={iconClass} />;
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-bold text-slate-300 text-start"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <div
            className={`absolute inset-y-0 flex items-center pointer-events-none ${
              direction === 'rtl' ? 'right-3.5' : 'left-3.5'
            }`}
          >
            {getIcon()}
          </div>
        )}
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir || direction}
          className={`w-full h-12 rounded-xl bg-[#080d19]/90 border border-slate-800 text-white text-sm font-medium focus:bg-[#0c1322] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-slate-500 ${
            icon ? (direction === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4') : 'px-4'
          } ${error ? 'border-red-500 bg-red-950/20' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-400 text-start">{error}</p>}
    </div>
  );
};

// --- Mobile Phone Input with Iraq Flag & +964 ---
interface PhoneFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  className?: string;
}

export const PhoneField: React.FC<PhoneFieldProps> = ({
  id = 'phone-input',
  label,
  value,
  onChange,
  error,
  className = '',
}) => {
  const { direction } = useI18n();

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-bold text-slate-300 text-start"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {/* Country Code Pill */}
        <div
          className={`absolute inset-y-0 flex items-center gap-1.5 px-3 pointer-events-none text-slate-300 font-semibold text-xs sm:text-sm border-e border-slate-800 ${
            direction === 'rtl' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="text-base">🇮🇶</span>
          <span dir="ltr" className="font-mono">
            +964
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        <input
          id={id}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="770 123 4567"
          dir="ltr"
          className={`w-full h-12 rounded-xl bg-[#080d19]/90 border border-slate-800 text-white text-sm font-medium focus:bg-[#0c1322] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-slate-500 font-mono ${
            direction === 'rtl' ? 'pr-28 pl-4 text-right' : 'pl-28 pr-4 text-left'
          } ${error ? 'border-red-500 bg-red-950/20' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-400 text-start">{error}</p>}
    </div>
  );
};

// --- Password Field with Show/Hide Toggle ---
interface PasswordFieldProps {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  className?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  className = '',
}) => {
  const [show, setShow] = useState(false);
  const { direction, t } = useI18n();
  const defaultPlaceholder = t('auth.reg.password_ph', 'کەمتر لە ٦ پیت نەبێت');
  const resolvedPlaceholder = placeholder !== undefined ? placeholder : defaultPlaceholder;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-bold text-slate-300 text-start"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <div
          className={`absolute inset-y-0 flex items-center pointer-events-none ${
            direction === 'rtl' ? 'right-3.5' : 'left-3.5'
          }`}
        >
          <Lock className="w-5 h-5 text-slate-500" />
        </div>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          dir={value ? 'ltr' : direction}
          className={`w-full h-12 rounded-xl bg-[#080d19]/90 border border-slate-800 text-white text-sm font-medium focus:bg-[#0c1322] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-slate-500 ${
            direction === 'rtl' ? 'pr-12 pl-12 text-right' : 'pl-12 pr-12 text-left'
          } ${error ? 'border-red-500 bg-red-950/20' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className={`absolute inset-y-0 flex items-center px-3.5 text-slate-400 hover:text-amber-300 cursor-pointer ${
            direction === 'rtl' ? 'left-0' : 'right-0'
          }`}
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 text-start">{error}</p>}
    </div>
  );
};

// --- Consent / Terms Checkbox Row ---
interface ConsentRowProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const ConsentRow: React.FC<ConsentRowProps> = ({
  id = 'consent-checkbox',
  checked,
  onChange,
  title,
  subtitle,
  className = '',
}) => {
  const { t } = useI18n();
  const displayTitle = title || t('auth.reg.consent_title', 'من مەرج و ڕێنماییەکان پەسەند دەکەم');
  const displaySubtitle = subtitle || t('auth.reg.consent_subtitle', 'بە دروستکردنی هەژمار، تۆ مەرج و ڕێنماییەکان و سیاسەتی تایبەتەمەندی پەسەند دەکەیت.');

  return (
    <div
      className={`flex items-start gap-3 cursor-pointer select-none text-start ${className}`}
      onClick={() => onChange(!checked)}
    >
      <div
        className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition-all shrink-0 ${
          checked
            ? 'bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-500 text-slate-950 shadow-xs'
            : 'border-2 border-slate-700 bg-[#080d19] hover:border-amber-400'
        }`}
      >
        {checked && <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />}
      </div>
      <div className="flex-1">
        <p className="text-xs sm:text-sm font-bold text-slate-200 leading-snug">{displayTitle}</p>
        {displaySubtitle && (
          <p className="text-[11px] sm:text-xs text-slate-400 leading-tight mt-0.5">{displaySubtitle}</p>
        )}
      </div>
    </div>
  );
};

// --- Social Auth Buttons (Apple, Google, Facebook) ---
interface SocialAuthProps {
  onAppleClick?: () => void;
  onGoogleClick?: () => void;
  onFacebookClick?: () => void;
}

export const SocialAuthButtons: React.FC<SocialAuthProps> = ({
  onAppleClick,
  onGoogleClick,
  onFacebookClick,
}) => {
  return (
    <div className="grid grid-cols-3 gap-2.5 w-full">
      {/* Apple */}
      <button
        type="button"
        id="social-apple-btn"
        onClick={onAppleClick}
        className="h-11 rounded-xl border border-slate-700/80 bg-[#111b2e] hover:bg-[#17243a] hover:border-amber-500/30 active:scale-95 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-all shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.67 1.39-.58.67-1.09 1.74-.96 2.78 1.04.08 2.1-.55 2.71-1.3z" />
        </svg>
        <span>Apple</span>
      </button>

      {/* Google */}
      <button
        type="button"
        id="social-google-btn"
        onClick={onGoogleClick}
        className="h-11 rounded-xl border border-slate-700/80 bg-[#111b2e] hover:bg-[#17243a] hover:border-amber-500/30 active:scale-95 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-all shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.7c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 6.4 10.4 6.4z"
          />
        </svg>
        <span>Google</span>
      </button>

      {/* Facebook */}
      <button
        type="button"
        id="social-facebook-btn"
        onClick={onFacebookClick}
        className="h-11 rounded-xl border border-slate-700/80 bg-[#111b2e] hover:bg-[#17243a] hover:border-amber-500/30 active:scale-95 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-all shadow-xs"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1877F2]">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span>Facebook</span>
      </button>
    </div>
  );
};

// --- OTP 6-Digit Verification Input ---
interface OTPInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  onComplete?: (code: string) => void;
}

export const OTPInput: React.FC<OTPInputProps> = ({ value, onChange, onComplete }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const newOTP = [...value];
    newOTP[index] = digit;
    onChange(newOTP);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOTP.every((d) => d !== '') && onComplete) {
      onComplete(newOTP.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-4" dir="ltr">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          id={`otp-input-${i}`}
          data-testid={`otp-input-${i}`}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`w-11 sm:w-12 h-14 sm:h-15 text-center text-xl sm:text-2xl font-bold rounded-2xl border transition-all outline-none ${
            value[i]
              ? 'border-amber-400 bg-amber-500/10 text-amber-200 ring-2 ring-amber-500/30'
              : 'border-slate-800 bg-[#080d19] text-white focus:bg-[#0c1322] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20'
          }`}
        />
      ))}
    </div>
  );
};
