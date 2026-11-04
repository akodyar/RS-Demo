const fs = require('fs');
let s = fs.readFileSync('src/pages/CompanyWorkspace.tsx', 'utf8');

// Add owners to tabs
s = s.replace(
  "{ id: 'home', label: 'Home', icon: <Home className=\"w-4 h-4\" /> },",
  "{ id: 'home', label: 'Home', icon: <Home className=\"w-4 h-4\" /> },\n          { id: 'owners', label: 'Owners', icon: <Shield className=\"w-4 h-4\" /> },"
);

s = s.replace(
  "{activeTab === 'operations' && renderOperations()}",
  "{activeTab === 'operations' && renderOperations()}\n        {activeTab === 'owners' && (\n          <div className=\"bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden\">\n            <div className=\"p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center\">\n              <h3 className=\"font-bold text-slate-900\">Managed Owners</h3>\n              <button className=\"bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors\">\n                Invite Owner\n              </button>\n            </div>\n            <div className=\"p-4\">\n              <div className=\"p-4 border border-slate-200 rounded-lg flex justify-between items-center\">\n                <div>\n                  <p className=\"font-bold text-slate-900\">Sarah Jenkins</p>\n                  <p className=\"text-xs text-slate-500\">2 Properties Managed • Auth Active</p>\n                </div>\n                <button className=\"text-sm text-indigo-600 font-medium hover:underline\">View Details</button>\n              </div>\n            </div>\n          </div>\n        )}"
);

fs.writeFileSync('src/pages/CompanyWorkspace.tsx', s);
