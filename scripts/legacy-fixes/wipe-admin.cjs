const fs = require('fs');

function replaceWithEmptyState(filepath, titleKey, titleDefault, icon) {
  if (!fs.existsSync(filepath)) return;
  const s = `
import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { ${icon} } from 'lucide-react';

export const ${filepath.split('/').pop().replace('.tsx', 'Page')} : React.FC = () => {
  const { t, direction } = useI18n();

  return (
    <div className={\`p-6 max-w-7xl mx-auto flex flex-col gap-6 \${direction === 'rtl' ? 'font-arabic' : 'font-sans'}\`} dir={direction}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-lg shadow-sm">
            <${icon} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('${titleKey}', '${titleDefault}')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t('ui.feature_unavailable', 'This feature is currently unavailable or pending integration.')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <${icon} className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">{t('ui.no_data', 'No Data Available')}</h3>
        <p className="text-slate-500 max-w-md mx-auto">{t('ui.module_not_configured', 'This module has not been fully configured with real data sources yet.')}</p>
      </div>
    </div>
  );
};
`;
  fs.writeFileSync(filepath, s);
}

replaceWithEmptyState('src/pages/PlatformAdminWorkspace.tsx', 'admin.control_center', 'Platform Admin', 'ShieldAlert');

console.log('Admin wiped.');
