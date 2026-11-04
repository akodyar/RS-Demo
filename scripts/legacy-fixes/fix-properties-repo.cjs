const fs = require('fs');
let s = fs.readFileSync('src/server/repositories/properties.ts', 'utf8');

if (!s.includes('getPropertyById')) {
  s = s.replace(
    "export const propertyRepository",
    `
  async getPropertyById(id: string) {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async addUnit(propertyId: string, unitData: any) {
    const { units } = require('../../db/schema.js');
    const [newUnit] = await db.insert(units).values({
      propertyId,
      unitNumber: unitData.unitNumber,
      beds: unitData.beds,
      baths: unitData.baths,
      status: 'VACANT',
    }).returning();
    return newUnit;
  }
}

export const propertyRepository`
  );
  fs.writeFileSync('src/server/repositories/properties.ts', s);
}
