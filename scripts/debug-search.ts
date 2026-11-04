async function check() {
  const apiRes = await fetch('http://localhost:3000/api/marketplace/listings/search?type=RENT&limit=100');
  const apiJson = await apiRes.json();
  console.log('Total items returned by API:', apiJson.items?.length);
  
  // Now let's see how SearchExplorerPage maps them
  const mapped = apiJson.items.map((item: any) => {
    const pt = (item.property?.type || '').toLowerCase();
    let category = 'apartment';
    if (pt.includes('villa')) category = 'villa';
    else if (pt.includes('warehouse') || pt.includes('storage') || pt.includes('industrial')) category = 'warehouse';
    else if (pt.includes('house') || pt.includes('single_family')) category = 'house';
    else if (pt.includes('studio')) category = 'studio';
    else if (pt.includes('office')) category = 'office';
    else if (pt.includes('duplex')) category = 'duplex';
    else if (pt.includes('commercial')) category = 'commercial';
    else if (pt.includes('residential') || pt.includes('building')) category = 'residential';
    
    return {
      title: item.title,
      type: item.type,
      propType: item.property?.type,
      category,
      price: item.price
    };
  });

  const categories = ['apartment', 'house', 'villa', 'commercial', 'studio', 'office', 'warehouse', 'duplex', 'residential'];
  for (const cat of categories) {
    const count = mapped.filter((m: any) => m.category === cat).length;
    const e2e = mapped.find((m: any) => m.category === cat && m.title.includes('E2E Consistency'));
    console.log(`Category "${cat}": total ${count}, E2E found: ${e2e ? e2e.title : 'NOT FOUND'}`);
  }
}

check().catch(console.error);
