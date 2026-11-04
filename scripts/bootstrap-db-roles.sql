-- ============================================================================
-- HomeHub Production Database Role Bootstrap & Least-Privilege Hardening
-- Database: homehub_production
-- Target Engine: PostgreSQL 16
-- ============================================================================

-- 1. Create Roles if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'homehub_app') THEN
    CREATE ROLE homehub_app WITH LOGIN PASSWORD 'PLACEHOLDER_SET_VIA_SECRET_MANAGER';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'homehub_migration') THEN
    CREATE ROLE homehub_migration WITH LOGIN PASSWORD 'PLACEHOLDER_SET_VIA_SECRET_MANAGER';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'homehub_backup') THEN
    CREATE ROLE homehub_backup WITH LOGIN PASSWORD 'PLACEHOLDER_SET_VIA_SECRET_MANAGER';
  END IF;
END $$;

-- 2. Revoke insecure public defaults
REVOKE ALL ON DATABASE homehub_production FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- 3. Database Connection Privileges
GRANT CONNECT ON DATABASE homehub_production TO homehub_app;
GRANT CONNECT ON DATABASE homehub_production TO homehub_migration;
GRANT CONNECT ON DATABASE homehub_production TO homehub_backup;

-- 4. Schema USAGE and DDL Privileges
-- Migration role requires CREATE to add/alter/drop tables during Drizzle migrations
GRANT USAGE, CREATE ON SCHEMA public TO homehub_migration;
-- Application role requires USAGE to read/write data, strictly NO CREATE (no DDL)
GRANT USAGE ON SCHEMA public TO homehub_app;
-- Backup role requires USAGE for streaming table reads, strictly NO CREATE
GRANT USAGE ON SCHEMA public TO homehub_backup;

-- 5. Default Privileges for Objects Created by Migration Role
ALTER DEFAULT PRIVILEGES FOR ROLE homehub_migration IN SCHEMA public
  GRANT ALL ON TABLES TO homehub_migration;
ALTER DEFAULT PRIVILEGES FOR ROLE homehub_migration IN SCHEMA public
  GRANT ALL ON SEQUENCES TO homehub_migration;

-- Application role receives DML permissions on newly created tables
ALTER DEFAULT PRIVILEGES FOR ROLE homehub_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO homehub_app;
ALTER DEFAULT PRIVILEGES FOR ROLE homehub_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO homehub_app;

-- Backup role receives SELECT-only permissions on newly created tables
ALTER DEFAULT PRIVILEGES FOR ROLE homehub_migration IN SCHEMA public
  GRANT SELECT ON TABLES TO homehub_backup;

-- Apply to existing objects in schema public (if any exist)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO homehub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO homehub_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO homehub_backup;
GRANT ALL ON ALL TABLES IN SCHEMA public TO homehub_migration;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO homehub_migration;

-- 6. Role Hardening Guards
ALTER ROLE homehub_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE homehub_migration NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE homehub_backup NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
