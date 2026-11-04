const fs = require('fs');
let code = fs.readFileSync('src/pages/VendorWorkspace.tsx', 'utf8');

const searchPattern = /const \[data, setData\] = useState<VendorDashboardData>\(\{[\s\S]*?\}\);/;
code = code.replace(searchPattern, `const [data, setData] = useState<VendorDashboardData>({
    kpi: {
      activeWorkOrders: 0,
      workOrdersDelta: 0,
      scheduledToday: 0,
      scheduledDelta: 0,
      pendingQuotes: 0,
      pendingQuotesDelta: 0,
      completedThisMonth: 0,
      completedDelta: 0,
      totalEarningsThisMonth: 0,
      earningsDelta: 0,
      averageRating: 0,
      ratingDelta: 0,
      currency: 'IQD',
    },
    jobActivity: {
      period: 'Last 7 days',
      days: [],
    },
    requestOverview: {
      totalRequests: 0,
      new: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
    },
    todaySchedule: [],
    recentRequests: [],
    messages: [],
    workOrders: [],
    quotes: [],
    invoices: [],
    tasks: [],
  });`);

fs.writeFileSync('src/pages/VendorWorkspace.tsx', code);
