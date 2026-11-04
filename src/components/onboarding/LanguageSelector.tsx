import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface LanguageSelectorProps {
  variant?: 'light' | 'dark' | 'transparent';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'transparent',
  className = '',
}) => {
  const { language, setLanguage, direction } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'ku', label: 'کوردی (سۆرانی)', short: 'کوردی', flag: '☀️' },
    { code: 'ar', label: 'العربية', short: 'العربية', flag: '🇮🇶' },
    { code: 'en', label: 'English', short: 'English', flag: '🇬🇧' },
  ] as const;

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const variantStyles = {
    transparent: 'bg-[#0c1322]/80 backdrop-blur-md text-slate-200 border border-slate-700/80 hover:border-amber-500/40 hover:text-white shadow-sm',
    light: 'bg-[#0c1322]/90 backdrop-blur-md text-slate-200 border border-slate-700/80 shadow-xs hover:border-amber-500/40 hover:text-white',
    dark: 'bg-[#080d19] text-slate-200 border border-slate-800 hover:border-amber-500/40 hover:text-white',
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="language-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        dir="ltr"
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${variantStyles[variant]}`}
      >
        <Globe className="w-4 h-4 shrink-0 text-amber-400/90" />
        <span className="font-semibold tracking-wide">{currentLang.short}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 ${
            direction === 'rtl' ? 'left-0' : 'right-0'
          } w-44 bg-[#0c1322] rounded-2xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {languages.map((item) => (
            <button
              key={item.code}
              id={`lang-option-${item.code}`}
              type="button"
              onClick={() => {
                setLanguage(item.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                language === item.code
                  ? 'text-amber-400 bg-amber-500/10 font-bold'
                  : 'text-slate-300 hover:bg-[#111b2e] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{item.flag}</span>
                <span>{item.label}</span>
              </div>
              {language === item.code && <Check className="w-4 h-4 text-amber-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
