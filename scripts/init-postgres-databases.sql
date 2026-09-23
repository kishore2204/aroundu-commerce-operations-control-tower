-- Creates the six per-service databases on a local PostgreSQL server (native Windows install,
-- not Docker). Run once via psql:
--   & "C:\Program Files\PostgreSQL\<version>\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -f scripts\init-postgres-databases.sql
-- Safe to re-run: skips any database that already exists instead of erroring.
-- One database per service, mirroring the DB-per-service isolation each service already has
-- today via its own H2 in-memory instance.
SELECT 'CREATE DATABASE lbos_platform' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_platform')\gexec
SELECT 'CREATE DATABASE lbos_partner' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_partner')\gexec
SELECT 'CREATE DATABASE lbos_commerce' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_commerce')\gexec
SELECT 'CREATE DATABASE lbos_order' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_order')\gexec
SELECT 'CREATE DATABASE lbos_fleet' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_fleet')\gexec
SELECT 'CREATE DATABASE lbos_finance' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lbos_finance')\gexec
