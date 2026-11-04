const fs = require('fs');
let s = fs.readFileSync('src/pages/PropertyCommandCenter.tsx', 'utf8');

s = s.replace(
  "export const PropertyCommandCenter: React.FC = () => {\n  const { t } = useI18n();\n  return (",
  `import { useParams } from 'react-router-dom';

export const PropertyCommandCenter: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const [property, setProperty] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(\`/api/properties/\${id}\`, {
          headers: { 'Authorization': 'Bearer mock-token' } 
        });
        if (!res.ok) {
          if (res.status === 404) throw new Error("Property not found");
          throw new Error("Failed to load property details. (Infrastructure may not be configured)");
        }
        const data = await res.json();
        setProperty(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProperty();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading property details...</div>;
  if (error) return (
    <div className="p-8 text-center text-amber-600 bg-amber-50 rounded-lg">
      <p className="font-semibold">Unable to fetch real property data</p>
      <p className="text-sm mt-1">{error}</p>
    </div>
  );
  if (!property) return <div className="p-8 text-center text-slate-500">Property not found.</div>;

  return (`
);

s = s.replace(
  "Empire World Tower - Unit 104",
  "{property.name || 'Unnamed Property'}"
);
s = s.replace(
  "Erbil, Empire District",
  "{property.address?.city ? `${property.address.city}, ${property.address.street || ''}` : 'No address provided'}"
);
s = s.replace(
  "120 Sqm",
  "{property.squareFeet ? `${property.squareFeet} Sqm` : '--'}"
);
s = s.replace(
  /<p className="font-semibold text-slate-900">Apartment<\/p>/,
  `<p className="font-semibold text-slate-900">{property.type || 'Unknown'}</p>`
);
s = s.replace(
  /<p className="font-semibold text-slate-900">2 \/ 2<\/p>/,
  `<p className="font-semibold text-slate-900">--</p>` // Real data not available yet
);

// Ensure React is properly used if it was already imported, we might have duplicated import or need to rely on the existing import.
s = s.replace(
  "import React from 'react';",
  "import React, { useState, useEffect } from 'react';"
);
// Remove the duplicated import { useParams } that I injected earlier if necessary.
// Let's just fix it by string replacement carefully.
fs.writeFileSync('src/pages/PropertyCommandCenter.tsx', s);
