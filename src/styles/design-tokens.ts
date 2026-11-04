/**
 * HOMEHUB MASTER MOBILE DESIGN TOKENS
 * Extracted directly from Master Reference Images (Screen 1 & Screen 2)
 * Primary source of truth for all mobile screens, role workspaces, and components.
 */

export const HomeHubTokens = {
  colors: {
    // Primary Brand Blue
    primary: '#0066fe',
    primaryHover: '#0057e0',
    primaryPressed: '#0047b8',
    primaryLight: '#edf4ff',
    primaryRing: 'rgba(0, 102, 254, 0.25)',

    // Deep Navy & Twilight
    navy: '#0b5bb7',
    twilightDark: '#071326',
    slateDark: '#0f172a',

    // Neutrals
    white: '#ffffff',
    surface: '#ffffff',
    surfaceSoft: '#f8fafc',
    surfaceCard: '#f0f6ff',
    borderSoft: '#e2e8f0',
    borderCard: '#dbe8fd',

    // Typography
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textWhite: '#ffffff',
    textBlue: '#0066fe',

    // Contextual Feature Pastels & Badges (Matching Master References)
    categories: {
      buy: {
        bg: '#edf4ff',
        border: '#d2e4ff',
        icon: '#1a68f5',
        label: 'کڕین',
      },
      rent: {
        bg: '#e6fcf1',
        border: '#bbf7d0',
        icon: '#059669',
        label: 'کرێ',
      },
      sell: {
        bg: '#f4efff',
        border: '#e9d5ff',
        icon: '#7c3aed',
        label: 'فرۆشتن',
      },
      services: {
        bg: '#fff4e8',
        border: '#fed7aa',
        icon: '#ea580c',
        label: 'خزمەتگوزاری',
      },
      manage: {
        bg: '#ffebee',
        border: '#fecdd3',
        icon: '#e11d48',
        label: 'بەڕێوەبردن',
      },
    },
  },

  radii: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    card: '24px',
    sheet: '34px',
    button: '9999px',
    pill: '9999px',
  },

  typography: {
    fontFamily:
      "'Vazirmatn', 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    headlineLarge: 'text-[28px] sm:text-[34px] font-black tracking-tight leading-[1.22]',
    headlineMedium: 'text-2xl sm:text-3xl font-black tracking-tight leading-tight',
    bodyMedium: 'text-[13px] sm:text-[15px] font-medium leading-relaxed',
    bodySmall: 'text-xs sm:text-sm font-medium leading-relaxed',
    ctaText: 'text-base font-extrabold tracking-wide',
  },

  spacing: {
    gutter: 'px-5 sm:px-6',
    section: 'py-4 sm:py-6',
    sheetPadding: 'px-5 sm:px-6 pt-5 pb-4',
  },

  dimensions: {
    ctaHeight: 'h-13 sm:h-14',
    inputHeight: 'h-13 sm:h-14',
    headerHeight: 'h-14',
    iconTileSize: 'w-14 h-14 sm:w-16 sm:h-16',
    minTouchTarget: '44px',
  },

  shadows: {
    cta: 'shadow-lg shadow-blue-600/25',
    card: 'shadow-[0_4px_20px_rgba(0,0,0,0.04)]',
    sheet: 'shadow-[0_-12px_35px_rgba(0,0,0,0.18)]',
    pill: 'shadow-md shadow-slate-200/50',
  },
} as const;
