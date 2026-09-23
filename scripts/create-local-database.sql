-- DEVELOPMENT ONLY. Creates the login role and the ONE shared database that all six AroundU services use
-- (the names / password are the defaults in every service's application.properties).
-- Safe to re-run: skips whatever already exists. Tables are NOT created here - each service's Hibernate
-- (ddl-auto=update) creates its own tables on first start, and the seeders fill them.
-- Run it through scripts\create-local-database.cmd (psql asks for the "postgres" password).
SELECT 'CREATE ROLE "Commerce_Operations_Control_Tower_user" LOGIN PASSWORD ''Tower_Tata@123'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'Commerce_Operations_Control_Tower_user')\gexec

SELECT 'CREATE DATABASE "Commerce_Operations_Control_Tower_db" OWNER "Commerce_Operations_Control_Tower_user"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'Commerce_Operations_Control_Tower_db')\gexec

SELECT datname AS database, pg_get_userbyid(datdba) AS owner
FROM pg_database WHERE datname = 'Commerce_Operations_Control_Tower_db';
