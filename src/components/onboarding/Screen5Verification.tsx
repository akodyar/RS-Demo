import React, { useState, useEffect } from 'react';
import { Check, Mail, Sparkles, Delete } from 'lucide-react';
import { OnboardingHeader } from './OnboardingHeader';
import { OTPInput, PrimaryCTA } from './FormControls';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen5VerificationProps {
  contactInfo: string;
  onVerify: (code: string) => void;
  onBack: () => void;
  onChangeContact: () => void;
}

export const Screen5Verification: React.FC<Screen5VerificationProps> = ({
  contactInfo,
  onVerify,
  onBack,
  onChangeContact,
}) => {
  const { t, direction } = useI18n();
  const [otp, setOtp] = useState<string[]>(['2', '7', '4', '9', '1', '8']);
  const [timeLeft, setTimeLeft] = useState(42);
  const [error, setError] = useState<string | null>(null);

  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleKeypadPress = (val: string) => {
    if (val === 'backspace') {
      const nextOtp = [...otp];
      for (let i = 5; i >= 0; i--) {
        if (nextOtp[i] !== '') {
          nextOtp[i] = '';
          break;
        }
      }
      setOtp(nextOtp);
      return;
    }

    const nextOtp = [...otp];
    const emptyIndex = nextOtp.findIndex((d) => d === '');
    if (emptyIndex !== -1) {
      nextOtp[emptyIndex] = val;
      setOtp(nextOtp);
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError(t('onboarding.validation.otp_incomplete', 'تکایە هەموو ٦ خانەکە پڕبکەرەوە.'));
      return;
    }
    if (code === '000000' || code === '111111') {
      setError(t('onboard.otp.invalid_code', 'کۆدی پشتڕاستکردنەوە هەڵەیە. تکایە دووبارە هەوڵبدەرەوە.'));
      return;
    }
    if (code === '999999') {
      setError(t('onboard.otp.expired_code', 'کاتی کۆدی پشتڕاستکردنەوە بەسەرچووە. تکایە داوای کۆدی نوێ بکە.'));
      return;
    }
    setError(null);
    onVerify(code);
  };

  const handleResend = () => {
    setTimeLeft(45);
    setError(null);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 5000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboarding.step_4_of_4', 'قۆناغی ٤ لە ٤')} />
      </div>

      {/* Main Content: Centered Modern Card */}
      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-6 sm:py-10 flex flex-col justify-center items-center">
        <div className="w-full bg-[#0c1322] rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-2xl border border-slate-800 flex flex-col items-center text-center space-y-4" dir={direction}>
          {/* Central Illustration: Envelope with Green Checkmark & Sparkles */}
          <div className="relative w-24 h-24 my-1 flex items-center justify-center">
            {/* Subtle Ambient Circle */}
            <div className="absolute inset-0 bg-amber-500/10 rounded-full scale-125 -z-0" />

            {/* Sparkles */}
            <Sparkles className="absolute -top-1 end-1 w-5 h-5 text-amber-400 fill-amber-300" />
            <Sparkles className="absolute -bottom-1 start-1 w-4 h-4 text-amber-300 fill-amber-400" />

            {/* 3D-styled Envelope */}
            <div className="relative z-10 w-18 h-14 bg-gradient-to-b from-[#111b2e] to-[#080d19] rounded-xl shadow-lg border border-slate-700/80 flex items-center justify-center">
              {/* Letter insert */}
              <div className="w-14 h-10 bg-amber-500/20 border border-amber-500/40 rounded-lg shadow-inner flex items-center justify-center">
                <Mail className="w-7 h-7 text-amber-300" />
              </div>

              {/* Checkmark Badge */}
              <div className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md ring-2 ring-[#0c1322]">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {t('onboard.otp.title', 'کۆدی پشتڕاستکردنەوە')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {t('onboard.otp.sent_to', 'کۆدی ٦ ژمارەییەکان ناردووە بۆ:')}
            </p>
            <p data-testid="otp-contact-info" className="text-sm font-bold text-amber-300 dir-ltr font-mono bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block">
              {contactInfo || 'arian@example.com'}
            </p>
            <p className="text-xs text-slate-400">
              {t('onboard.otp.prompt', 'تکایە کۆدەکە لە خانەکانی خوارەوە بنووسە.')}
            </p>
          </div>

          {/* 6 OTP Boxes */}
          <div className="py-2">
            <OTPInput value={otp} onChange={setOtp} />
          </div>

          {error && (
            <p id="otp-error-msg" data-testid="otp-error-msg" className="text-xs text-rose-300 font-medium bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-1.5 w-full">
              {error}
            </p>
          )}

          {resendSuccess && (
            <p id="otp-resend-success" data-testid="otp-resend-success" className="text-xs text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 w-full">
              {t('onboard.otp.resent_success', 'کۆدی نوێی پشتڕاستکردنەوە بە سەرکەوتوویی نێردرا.')}
            </p>
          )}

          {/* Countdown Timer */}
          <div className="text-xs font-semibold text-slate-400">
            {timeLeft > 0 ? (
              <span>
                {t('onboard.otp.resend_in', 'دووبارە ناردنی کۆد لە')}{' '}
                <span className="font-mono text-amber-400 font-bold" dir="ltr">
                  {formatTime(timeLeft)}
                </span>
              </span>
            ) : (
              <button
                type="button"
                id="otp-resend-btn"
                data-testid="otp-resend-btn"
                onClick={handleResend}
                className="text-amber-400 font-bold hover:text-amber-300 hover:underline cursor-pointer"
              >
                {t('onboard.otp.resend', 'دووبارە ناردنی کۆد')}
              </button>
            )}
          </div>

          {/* Primary CTA */}
          <div className="w-full pt-2">
            <PrimaryCTA id="otp-verify-btn" onClick={handleVerify}>
              {t('onboard.otp.verify_btn', 'دڵنیابوون و بەردەوامبوون')}
            </PrimaryCTA>
          </div>

          {/* Change Number Link */}
          <div>
            <button
              type="button"
              id="otp-change-contact-btn"
              data-testid="otp-change-contact-btn"
              onClick={onChangeContact}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {t('onboard.otp.wrong_number', 'زانیاری پەیوەندی هەڵەیە؟')}{' '}
              <span className="text-amber-400 font-bold underline underline-offset-2 hover:text-amber-300">
                {t('onboard.otp.change_number', 'گۆڕینی زانیاری')}
              </span>
            </button>
          </div>

          {/* Numeric Keypad Simulation */}
          <div className="w-full bg-[#080d19] rounded-2xl border border-slate-800 p-3 pt-3 select-none mt-2">
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[
                { num: '1', sub: '' },
                { num: '2', sub: 'ABC' },
                { num: '3', sub: 'DEF' },
                { num: '4', sub: 'GHI' },
                { num: '5', sub: 'JKL' },
                { num: '6', sub: 'MNO' },
                { num: '7', sub: 'PQRS' },
                { num: '8', sub: 'TUV' },
                { num: '9', sub: 'WXYZ' },
                { num: '', sub: '' },
                { num: '0', sub: '' },
                { num: 'backspace', sub: '' },
              ].map((k, i) => {
                if (k.num === '') return <div key={i} />;
                if (k.num === 'backspace') {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleKeypadPress('backspace')}
                      className="h-10 rounded-xl bg-[#111b2e] hover:bg-[#182740] active:scale-95 shadow-xs border border-slate-700/80 flex items-center justify-center text-slate-300 transition-all cursor-pointer"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleKeypadPress(k.num)}
                    className="h-10 rounded-xl bg-[#111b2e] hover:bg-[#182740] active:scale-95 shadow-xs border border-slate-700/80 flex flex-col items-center justify-center transition-all cursor-pointer"
                  >
                    <span className="font-bold text-base text-white leading-none">
                      {k.num}
                    </span>
                    {k.sub && (
                      <span className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">
                        {k.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
