-- Run ONCE per database as a database owner (DBA / hosting control panel), after `npm run migrate`.
-- Creates the API's least-privilege role and makes the audit log append-only.
-- Then add the login the API uses at runtime:  ALTER ROLE lms_app ADD MEMBER [<api_user>];

IF DATABASE_PRINCIPAL_ID('lms_app') IS NULL
  CREATE ROLE lms_app AUTHORIZATION dbo;
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO lms_app;
GO
DENY UPDATE, DELETE ON dbo.admin_audit_log TO lms_app;
GO
