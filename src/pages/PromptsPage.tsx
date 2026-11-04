import React, { useState } from 'react';
import { Download, FileText, Check, ArrowLeft, ArrowRight, Copy, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

interface PromptItem {
  id: string;
  seq: number;
  title: string;
  phase: string;
  timestamp: string;
  userPrompt: string;
  mdFile: string;
  txtFile: string;
}

const PROMPTS_LIST: PromptItem[] = [
  {
    id: 'p1',
    seq: 1,
    title: 'Prompt 1: Multi-Role Real Estate Platform Architecture (HomeHub)',
    phase: 'Foundation & Architecture',
    timestamp: '2026-09-18 Session Start',
    userPrompt: `Create a comprehensive real estate application named 'HomeHub' (HomeHub — پلاتفۆرمی مۆدێرنی خانووبەرە) tailored for Kurdistan and Iraq, featuring:
1. Multilingual support: Kurdish Sorani (کوردی), Arabic (العربية), and English (English), with dynamic RTL (Right-to-Left) and LTR layout switching.
2. 6 distinct user roles with tailored workspaces:
   - Owner / Landlord (خاوەن موڵک): Property listings, tenant contracts, rent collection, maintenance dispatch.
   - Tenant (کرێچی): Active lease management, digital rent payments, maintenance request tracker.
   - Real Estate Agency / Company (کۆمپانیای خانووبەرە): Multi-agent management, verified MLS listings, deal pipeline.
   - Service Provider / Vendor (خزمەتگوزاری): Maintenance job board, quotes, active repairs, invoice settlement.
   - Platform Admin / Property Manager (بەڕێوەبەر): System audit logs, KYC verification, listings moderation.
3. Property lifecycle management: Rent, Services, Property Passport, and maintenance workflows.
4. Clean, responsive design supporting mobile and desktop viewports.`,
    mdFile: '/prompts/prompt-01-initial-platform-specification.md',
    txtFile: '/prompts/prompt-01-initial-platform-specification.txt',
  },
  {
    id: 'p2',
    seq: 2,
    title: 'Prompt 2: Specialized Company & Tenant Onboarding Flows',
    phase: 'Onboarding & Registration',
    timestamp: '2026-09-18 Turn 2',
    userPrompt: `Implement dedicated onboarding flows for:
1. Real Estate Companies: Agency registration, commercial license verification, office branch details, agent team invitations, and initial portfolio batch upload.
2. Tenants: Digital lease acceptance, security deposit receipt confirmation, emergency contact setup, and direct maintenance request initiation.
3. Add routing and navigation for /onboarding/tenant, /onboarding/company, and /tenant/maintenance/new.`,
    mdFile: '/prompts/prompt-02-company-and-tenant-onboarding.md',
    txtFile: '/prompts/prompt-02-company-and-tenant-onboarding.txt',
  },
  {
    id: 'p3',
    seq: 3,
    title: 'Prompt 3: Kurdish Sorani Localization & Workspaces Hardening',
    phase: 'Localization & Workspaces',
    timestamp: '2026-09-18 Turn 3',
    userPrompt: `Localize all workspace views, headings, navigation elements, action buttons, and status labels into natural Kurdish Sorani.
Remove English placeholders and ensure consistent real estate terminology (خاوەن موڵک, کرێچی, پشکنین, گرێبەست, خزمەتگوزاری, کرێی مانگانە, دۆخی داواکاری) across the Owner, Tenant, Vendor, Company, and Admin dashboards.`,
    mdFile: '/prompts/prompt-03-full-kurdish-localization-and-workspaces.md',
    txtFile: '/prompts/prompt-03-full-kurdish-localization-and-workspaces.txt',
  },
  {
    id: 'p4',
    seq: 4,
    title: 'Prompt 4: Master Mobile Onboarding Screen Integration (Design Reference)',
    phase: 'Visual Redesign & Entry Point',
    timestamp: '2026-09-18 Turn 4',
    userPrompt: `[Attached Reference Image: file_00000000fbdc8243b0e3271f11368a1e.png]
Make the first page that appears when opening the application strictly match the provided reference design:
- Full-bleed background of a modern luxury glass villa at dusk with illuminated turquoise pool and warm glowing interior.
- HomeHub 3D badge with royal blue roof, white body, and 4 emerald window panes, plus the Kurdish tagline 'ماڵی باشتر، ژیانی باشتر'.
- Translucent frosted language switcher pill ('🌐 کوردی ⌵') on top.
- Kurdish headline: 'هەموو ڕێگاکان بۆ موڵک لە یەک شوێن' and subtitle: 'پلاتفۆڕمێکی مۆدێرن بۆ کڕین، فرۆشتن، کرێ، بەڕێوەبردنی موڵک و خزمەتگوزاری.'.
- Floating bottom white card with 4 pastel quick-action tiles: کڕین (House), کرێ (Key), فرۆشتن (Building), خزمەتگوزاری (Wrench).
- Primary pill button 'دەستپێ بکە' with right-pointing arrow.
- Secondary sign-in text: 'هەژماری هەیە؟ چوونە ژوورەوە'.
- 4 pagination indicator dots with the first dot active.
- Set this as the root entry point ('/') of the application.`,
    mdFile: '/prompts/prompt-04-mobile-onboarding-design-reference.md',
    txtFile: '/prompts/prompt-04-mobile-onboarding-design-reference.txt',
  },
  {
    id: 'p5',
    seq: 5,
    title: 'Prompt 5: Visual Fidelity & Layout Inversion Correction',
    phase: 'Defect Correction & Polish',
    timestamp: '2026-09-18 Turn 5',
    userPrompt: `[Attached Screenshot: Screenshot_20260918-182248.png]
This is what you have created and it is far more different than what I have asked you to use.`,
    mdFile: '/prompts/prompt-05-visual-fidelity-and-rtl-fix.md',
    txtFile: '/prompts/prompt-05-visual-fidelity-and-rtl-fix.txt',
  },
  {
    id: 'p6',
    seq: 6,
    title: 'Prompt 6: Export All Prompts as Downloadable Files',
    phase: 'Export & Documentation',
    timestamp: '2026-09-18 Turn 6 (Current)',
    userPrompt: `give me all the prompts I have given to you. in separate files ready to download`,
    mdFile: '/prompts/prompt-06-export-prompts-request.md',
    txtFile: '/prompts/prompt-06-export-prompts-request.txt',
  },
];

export const PromptsPage: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { direction, t } = useI18n();

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <div 
      dir={direction} 
      className={`min-h-screen bg-slate-950 text-slate-100 pb-16 ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Return to HomeHub"
            >
              <BackIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>📁 Project Prompts Archive</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
                  {PROMPTS_LIST.length} Files Ready
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                All prompts provided across the HomeHub development session
              </p>
            </div>
          </div>

          {/* Download All ZIP CTA */}
          <div className="flex items-center gap-2.5">
            <a
              href="/prompts/homehub-all-prompts.zip"
              download="homehub-all-prompts.zip"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Download All Prompts (.ZIP)</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Intro banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-950/30 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Every prompt is stored as a standalone file
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              You can download each prompt individually in both <strong>Markdown (.md)</strong> and <strong>Plain Text (.txt)</strong> formats, copy prompt text directly to your clipboard, or download the bundled ZIP package.
            </p>
          </div>
          <a
            href="/prompts/all-prompts-summary.md"
            download="all-prompts-summary.md"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary Index (.md)</span>
          </a>
        </div>

        {/* List of prompts */}
        <div className="space-y-6">
          {PROMPTS_LIST.map((prompt) => (
            <article
              key={prompt.id}
              className="rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl overflow-hidden transition-all hover:border-slate-700"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-slate-800/40 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-sm flex items-center justify-center shrink-0">
                    #{prompt.seq}
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {prompt.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="text-blue-400 font-medium">{prompt.phase}</span>
                      <span>•</span>
                      <span>{prompt.timestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: Download individual files & Copy */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleCopy(prompt.id, prompt.userPrompt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
                    title="Copy prompt text"
                  >
                    {copiedId === prompt.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <a
                    href={prompt.txtFile}
                    download={prompt.txtFile.split('/').pop()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                    title="Download Plain Text format"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>.TXT</span>
                  </a>

                  <a
                    href={prompt.mdFile}
                    download={prompt.mdFile.split('/').pop()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-xs font-semibold text-blue-400 border border-blue-500/30 transition-colors"
                    title="Download Markdown format"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>.MD</span>
                  </a>
                </div>
              </div>

              {/* Prompt Text Box */}
              <div className="p-5">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs sm:text-sm text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                  {prompt.userPrompt}
                </pre>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};
