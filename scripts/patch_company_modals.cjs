const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'company', 'CompanyModals.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern:
// <div (id="[^"]*")? className="fixed inset-0 z-50 bg-slate-900/[^"]*"[^>]*>
//   <div 
//     className="...

// Let's replace each modal's outer backdrop and inner container
const targets = [
  // 1. SearchModal
  {
    outer: '<div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">',
    outerRep: '<div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150 cursor-pointer">',
    inner: '      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200">',
    innerRep: '      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 cursor-default">'
  },
  // 2. NotificationsDrawer
  {
    outer: '<div id="company-notifications-drawer" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">',
    outerRep: '<div id="company-notifications-drawer" onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150 cursor-pointer">',
    inner: '      <div \n        className={`bg-white w-full max-w-full sm:max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto',
    innerRep: '      <div \n        onClick={(e) => e.stopPropagation()}\n        className={`bg-white w-full max-w-full sm:max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto cursor-default'
  },
  // 3. CompanyProfileModal
  {
    outer: '<div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">\n      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">',
    outerRep: '<div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer">\n      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto cursor-default">'
  },
  // 4. MessagesDrawer
  {
    outer: '<div id="company-messages-drawer" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">',
    outerRep: '<div id="company-messages-drawer" onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150 cursor-pointer">',
    inner: '      <div \n        className={`bg-white w-full max-w-full sm:max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto',
    innerRep: '      <div \n        onClick={(e) => e.stopPropagation()}\n        className={`bg-white w-full max-w-full sm:max-w-md h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto cursor-default'
  }
];

let replacedCount = 0;
for (const t of targets) {
  if (t.outer && t.outerRep && content.includes(t.outer)) {
    content = content.replace(t.outer, t.outerRep);
    replacedCount++;
  }
  if (t.inner && t.innerRep && content.includes(t.inner)) {
    content = content.replace(t.inner, t.innerRep);
    replacedCount++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`CompanyModals patched with ${replacedCount} replacements`);

