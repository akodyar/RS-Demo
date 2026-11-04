const fs = require('fs');
let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

// Replace mock with empty states and actual loading logic
s = s.replace(
  "const [activeTab, setActiveTab] = useState('home');",
  "const [activeTab, setActiveTab] = useState('home');\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState<any>(null);\n\n  React.useEffect(() => {\n    const fetchCompanyData = async () => {\n      setLoading(true);\n      try {\n        // In a real app, this would be await fetch('/api/company/dashboard')\n        // For now, we simulate an empty response from the database because we have no real data yet.\n        setTimeout(() => {\n          setData({ properties: [], tasks: [], approvals: [], owners: [] });\n          setLoading(false);\n        }, 500);\n      } catch (e) {\n        setLoading(false);\n      }\n    };\n    fetchCompanyData();\n  }, [token]);"
);

s = s.replace(
  "const stats = [\n    { label: t('company.stats.owners', 'Owners'), value: '12' },\n    { label: t('company.stats.properties', 'Properties'), value: '45' },\n    { label: t('company.stats.units', 'Total Units'), value: '312' },\n    { label: t('company.stats.vacant', 'Vacant'), value: '18' },\n  ];",
  "const stats = [\n    { label: t('company.stats.owners', 'Owners'), value: data?.owners?.length || 0 },\n    { label: t('company.stats.properties', 'Properties'), value: data?.properties?.length || 0 },\n    { label: t('company.stats.tasks', 'Tasks'), value: data?.tasks?.length || 0 },\n    { label: t('company.stats.approvals', 'Approvals'), value: data?.approvals?.length || 0 },\n  ];"
);

s = s.replace(
  "<div className=\"space-y-3\">\n            <div className=\"p-3 bg-amber-50 border border-amber-100 rounded-lg flex justify-between items-center cursor-pointer\" onClick={() => setActiveTab('operations')}>\n              <div>\n                <p className=\"font-semibold text-sm text-slate-900\">3 {t('company.pending_approvals', 'Pending Approvals')}</p>\n                <p className=\"text-xs text-slate-600\">Maintenance & Quotes</p>\n              </div>\n              <ChevronRight className={`w-4 h-4 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />\n            </div>\n            <div className=\"p-3 bg-rose-50 border border-rose-100 rounded-lg flex justify-between items-center cursor-pointer\">\n              <div>\n                <p className=\"font-semibold text-sm text-slate-900\">12 {t('company.overdue_rent', 'Overdue Rent Payments')}</p>\n                <p className=\"text-xs text-slate-600\">Action required</p>\n              </div>\n              <ChevronRight className={`w-4 h-4 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />\n            </div>\n            <div className=\"p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center cursor-pointer\">\n              <div>\n                <p className=\"font-semibold text-sm text-slate-900\">5 {t('company.new_leads', 'New Leads')}</p>\n                <p className=\"text-xs text-slate-600\">Awaiting contact</p>\n              </div>\n              <ChevronRight className={`w-4 h-4 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />\n            </div>\n          </div>",
  "<div className=\"p-8 text-center bg-slate-50 border border-slate-200 rounded-lg\">\n            <CheckCircle className=\"w-8 h-8 text-slate-300 mx-auto mb-2\" />\n            <p className=\"text-sm text-slate-500\">No urgent items requiring attention.</p>\n          </div>"
);

s = s.replace(
  "<div className=\"space-y-3\">\n            <div className=\"flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg\">\n              <input type=\"checkbox\" className=\"mt-1\" />\n              <div>\n                <p className=\"text-sm font-semibold text-slate-900\">Review Lease Renewal (Unit 4B)</p>\n                <p className=\"text-xs text-slate-500\">Due today</p>\n              </div>\n            </div>\n            <div className=\"flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg\">\n              <input type=\"checkbox\" className=\"mt-1\" />\n              <div>\n                <p className=\"text-sm font-semibold text-slate-900\">Dispatch vendor to Empire Tower</p>\n                <p className=\"text-xs text-slate-500\">Due tomorrow</p>\n              </div>\n            </div>\n          </div>",
  "<div className=\"p-8 text-center bg-slate-50 border border-slate-200 rounded-lg\">\n            <CheckCircle className=\"w-8 h-8 text-slate-300 mx-auto mb-2\" />\n            <p className=\"text-sm text-slate-500\">No tasks assigned to you right now.</p>\n          </div>"
);

s = s.replace(
  "onClick={() => navigate('/properties/mock-1')}",
  ""
);

s = s.replace(
  "onClick={() => navigate('/properties/mock-2')}",
  ""
);

s = s.replace(
  "<div className=\"p-0\">\n        <div className=\"p-4 border-b border-slate-100 hover:bg-slate-50 flex justify-between items-center cursor-pointer\" >\n          <div className=\"flex items-center gap-3\">\n            <div className=\"w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600\">\n              <Building2 className=\"w-5 h-5\" />\n            </div>\n            <div>\n              <p className=\"font-bold text-slate-900\">Empire Tower</p>\n              <p className=\"text-xs text-slate-500\">120 Units • Owner: Sarah Jenkins</p>\n            </div>\n          </div>\n          <ChevronRight className={`w-5 h-5 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />\n        </div>\n        <div className=\"p-4 hover:bg-slate-50 flex justify-between items-center cursor-pointer\" >\n          <div className=\"flex items-center gap-3\">\n            <div className=\"w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600\">\n              <Building2 className=\"w-5 h-5\" />\n            </div>\n            <div>\n              <p className=\"font-bold text-slate-900\">Dream City Villas</p>\n              <p className=\"text-xs text-slate-500\">45 Units • Owner: Holding Group</p>\n            </div>\n          </div>\n          <ChevronRight className={`w-5 h-5 text-slate-400 ${direction === 'rtl' ? 'rotate-180' : ''}`} />\n        </div>\n      </div>",
  "<div className=\"p-12 text-center\">\n        <Building2 className=\"w-12 h-12 text-slate-300 mx-auto mb-3\" />\n        <h4 className=\"text-lg font-bold text-slate-700\">No Properties Found</h4>\n        <p className=\"text-sm text-slate-500 mb-4\">You have not been assigned any properties yet.</p>\n      </div>"
);

s = s.replace(
  "<div className=\"p-4 border border-slate-200 rounded-lg flex justify-between items-center\">\n                <div>\n                  <p className=\"font-bold text-slate-900\">Sarah Jenkins</p>\n                  <p className=\"text-xs text-slate-500\">2 Properties Managed • Auth Active</p>\n                </div>\n                <button className=\"text-sm text-indigo-600 font-medium hover:underline\">View Details</button>\n              </div>",
  "<div className=\"p-12 text-center\">\n                <Shield className=\"w-12 h-12 text-slate-300 mx-auto mb-3\" />\n                <h4 className=\"text-lg font-bold text-slate-700\">No Owners Found</h4>\n                <p className=\"text-sm text-slate-500 mb-4\">You don't have active management agreements with any owners.</p>\n              </div>"
);

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);
