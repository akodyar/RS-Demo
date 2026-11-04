const fs = require('fs');
let s = fs.readFileSync('src/pages/PropertyPassport.tsx', 'utf8');

// I will inject the fetch logic to retrieve property, leases, and rent schedules
s = s.replace(
  "export const PropertyPassport: React.FC = () => {\n  const { t, isRtl } = useI18n();\n  const [activeTab, setActiveTab] = useState('identity');",
  `import { useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export const PropertyPassport: React.FC = () => {
  const { t, isRtl } = useI18n();
  const { id } = useParams();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('identity');
  
  const [property, setProperty] = useState<any>(null);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch property
        let propRes = await fetch(\`/api/properties/\${id}\`, {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (propRes.status === 404) throw new Error("Property not found");
        if (!propRes.ok) throw new Error("Failed to load property data. Infrastructure may not be configured.");
        const propData = await propRes.json();
        setProperty(propData);

        // Fetch leases (assuming an endpoint exists, else catch gracefully)
        try {
          const leaseRes = await fetch(\`/api/properties/\${id}/leases\`, {
            headers: { 'Authorization': \`Bearer \${token}\` }
          });
          if (leaseRes.ok) {
            setLeases(await leaseRes.json());
          }
        } catch (e) {
          // Ignore lease fetch error
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id, token]);

  if (loading) return <div className="p-8 text-center text-slate-500 bg-white rounded-xl">Loading Property Passport...</div>;
  if (error) return (
    <div className="p-6 text-center text-amber-600 bg-amber-50 rounded-xl">
      <p className="font-semibold">Unable to fetch passport data</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );
  if (!property) return <div className="p-8 text-center text-slate-500 bg-white rounded-xl">Property not found.</div>;
`
);

// We need to make sure we don't have duplicate imports
s = s.replace(/import \{ useState \} from 'react';/, "import React, { useState, useEffect } from 'react';");
s = s.replace(/import React from 'react';\n/, ""); // Remove if we added it

fs.writeFileSync('src/pages/PropertyPassport.tsx', s);
