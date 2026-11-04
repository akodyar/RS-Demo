const fs = require('fs');
let s = fs.readFileSync('src/pages/PropertyCommandCenter.tsx', 'utf8');

// I'll just manually inject the state hook since it failed previously
s = s.replace(
  "export const PropertyCommandCenter: React.FC = () => {\n  const { t } = useI18n();",
  `import { useParams } from 'react-router-dom';\nexport const PropertyCommandCenter: React.FC = () => {\n  const { t } = useI18n();\n  const { id } = useParams();\n  const [property, setProperty] = useState<any>(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    const fetchProperty = async () => {\n      try {\n        const res = await fetch(\`/api/properties/\${id}\`, {\n          headers: { 'Authorization': 'Bearer mock-token' } \n        });\n        if (!res.ok) {\n          if (res.status === 404) throw new Error("Property not found");\n          throw new Error("Failed to load property details. (Infrastructure may not be configured)");\n        }\n        const data = await res.json();\n        setProperty(data);\n      } catch (err: any) {\n        setError(err.message);\n      } finally {\n        setLoading(false);\n      }\n    };\n    if (id) fetchProperty();\n  }, [id]);\n\n  if (loading) return <div className="p-8 text-center text-slate-500">Loading property details...</div>;\n  if (error) return (\n    <div className="p-8 text-center text-amber-600 bg-amber-50 rounded-lg">\n      <p className="font-semibold">Unable to fetch real property data</p>\n      <p className="text-sm mt-1">{error}</p>\n    </div>\n  );\n  if (!property) return <div className="p-8 text-center text-slate-500">Property not found.</div>;\n`
);

fs.writeFileSync('src/pages/PropertyCommandCenter.tsx', s);
