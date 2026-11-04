const fs = require('fs');

let s = fs.readFileSync('src/pages/OwnerWorkspace.tsx', 'utf8');

// I will just wipe out the entire Sidebar and replace it with a clean one.
// Let's find exactly what to wipe.
const sidebarRegex = /\{\/\* Sidebar: AI Recommendations & Alerts \*\/\}[\s\S]*\}\;/;

const newSidebar = `
        {/* Sidebar: AI Recommendations & Alerts */}
        <div className="flex flex-col gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-xl shadow-md p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-bold mb-4 relative z-10 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              {t('analytics.ai_recommendations')}
            </h3>
            
            <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 mb-4 text-center">
              <p className="text-sm text-slate-100">{t('ui.no_data', 'No AI insights available at this time.')}</p>
            </div>
            
            <p className="text-xs text-slate-400 text-center relative z-10">
              {t('analytics.ai_disclaimer', 'AI insights do not execute actions automatically.')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              {t('analytics.alerts')}
            </h3>
            <div className="flex flex-col gap-3">
              <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">
                {t('ui.no_data', 'No active alerts.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
`;

s = s.replace(sidebarRegex, newSidebar.trim());

fs.writeFileSync('src/pages/OwnerWorkspace.tsx', s);
