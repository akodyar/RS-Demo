import { db } from './src/db/index.js';
import { properties, users } from './src/db/schema.js';
import { propertyRepository } from './src/server/repositories/properties.js';

async function test() {
  console.log("Starting backend persistence test for property-specific fees...");
  try {
    // get a user
    const user = await db.select().from(users).limit(1);
    const userId = user[0].id;

    // Create Property A
    const propA = await propertyRepository.createProperty(userId, {
      name: "Property A Audit",
      type: "Apartment",
      address: { city: "Erbil" },
      rentFee: 0.05,
      managementFee: 0.10,
      operatingModel: "FULLY_MANAGED"
    });
    console.log("Property A created:", { rentFee: propA.rentFee, managementFee: propA.managementFee });

    // Create Property B
    const propB = await propertyRepository.createProperty(userId, {
      name: "Property B Audit",
      type: "Villa",
      address: { city: "Suli" },
      rentFee: 0.03,
      managementFee: 0.07,
      operatingModel: "FULLY_MANAGED"
    });
    console.log("Property B created:", { rentFee: propB.rentFee, managementFee: propB.managementFee });

    // Verify isolation and persistence
    if (propA.rentFee !== '0.05' || propA.managementFee !== '0.1') throw new Error("Prop A mismatched");
    if (propB.rentFee !== '0.03' || propB.managementFee !== '0.07') throw new Error("Prop B mismatched");

    console.log("✅ PostgreSQL Persistence Verified");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit(0);
  }
}
test();
