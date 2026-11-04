# HOMEHUB — MASTER UI/UX DESIGN SYSTEM SPECIFICATION

## 1. Design Philosophy
- **Mobile-First**: Designed natively for mobile viewports (320px, 360px, 375px, 390px, 393px, 414px, 430px) and progressively scaled for tablet and desktop widths up to 1280px.
- **Visual Tone**: Clean, premium, trustworthy, and modern. High visual contrast, generous whitespace, and subtle layered drop-shadows.
- **Action Clarity**: Exactly one prominent Primary Call-To-Action (CTA) per view to eliminate decision fatigue.

## 2. Localization & Directionality
- **Primary Language**: Kurdish Sorani (`ku`) — Right-to-Left (RTL).
- **Secondary Languages**: Arabic (`ar`) — Right-to-Left (RTL); English (`en`) — Left-to-Right (LTR).
- **Bidirectional Handling**:
  - Layouts flip automatically based on `direction === 'rtl'`.
  - Margin/padding alignment follows logical start/end utilities.
  - **LTR Isolation**: Technical strings (phone numbers `+964 750...`, transaction IDs, IBANs, URLs) must be rendered in explicit LTR direction (`dir="ltr"` or unicode isolation).

## 3. Color Palette & Semantics
- **Primary Blue**: `#0066FE` / `#1A68F5` (Brand anchor, primary CTAs, active indicators).
- **Deep Navy / Slate**: `#0F172A` / `#1E293B` (Headings, primary text, dark mode accents).
- **Surface Neutrals**: `#FFFFFF` (Card canvas), `#F8FAFC` (Page background), `#F1F5F9` (Dividers/pills).
- **Status Green (Success/Occupied/Verified)**: `#059669` (Text), `#E6FCF1` (Background).
- **Status Amber (Warning/Pending/Attention)**: `#D97706` (Text), `#FFFBEB` (Background).
- **Status Rose (Urgent/Overdue/Error)**: `#E11D48` (Text), `#FFF0F3` (Background).
- **Status Purple (Agency/Management)**: `#7C3AED` (Text), `#F4EFFF` (Background).

## 4. Typography & Spacing
- **Fonts**: Inter / Outfit for Latin text; Vazirmatn / Noto Sans Arabic for Kurdish Sorani and Arabic scripts.
- **Scale**:
  - Page Titles: 22px–26px (Font-Black, tracking-tight).
  - Section Headers: 16px–18px (Font-Bold).
  - Body Text: 13px–14px (Font-Medium).
  - Captions/Metadata: 10px–11px (Font-SemiBold, uppercase where appropriate).
- **Spacing Grid**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px.

## 5. UI Components Standards
- **Cards**: 16px to 24px border radius (`rounded-2xl`), subtle border (`border-slate-100`), soft shadow (`shadow-[0_2px_8px_rgba(0,0,0,0.04)]`).
- **Primary CTAs**: Height 52px–58px, full-width or pill-shaped, bold typography, high-contrast background with interactive active scale effects (`active:scale-[0.98]`).
- **Touch Targets**: Minimum 44px $\times$ 44px for all interactive buttons, icons, and chips.
- **Fixed Mobile Bottom Navigation**:
  - Height 64px, frosted/white background with top border.
  - 4 to 6 core navigation tabs with distinct icon and localized micro-label.
- **State Feedback**:
  - *Loading*: Animated spinner or skeleton shimmer.
  - *Empty State*: Centered icon, friendly localized title, descriptive helper text, and a direct action CTA.
  - *Error State*: High-visibility alert banner with retry trigger.
  - *Success State*: Animated checkmark with clear confirmation details and forward navigation.
