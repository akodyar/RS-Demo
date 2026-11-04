DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_property_unit_unique" UNIQUE("property_id","unit_number");
EXCEPTION
 WHEN duplicate_table OR duplicate_object THEN null;
END $$;
