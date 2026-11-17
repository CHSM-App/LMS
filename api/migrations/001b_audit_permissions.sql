-- 001b: the API's database role may read/insert audit rows but never change or remove them.
-- In production, add the API login's user to this role: ALTER ROLE lms_app ADD MEMBER <api_user>;
IF DATABASE_PRINCIPAL_ID('lms_app') IS NULL
  CREATE ROLE lms_app AUTHORIZATION dbo;
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO lms_app;
GO
DENY UPDATE, DELETE ON dbo.admin_audit_log TO lms_app;
GO
