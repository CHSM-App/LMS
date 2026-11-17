-- 001b: the API's database role may read/insert audit rows but never change or remove them.
-- Needs permission to create roles (db_owner / ALTER ANY ROLE). On hosted databases where the
-- migration login lacks that right, this step is skipped and a DBA runs
-- api/scripts/sql/setup-lms-app-role.sql once instead.
-- In production, add the API login's user to this role: ALTER ROLE lms_app ADD MEMBER <api_user>;
IF HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER ANY ROLE') = 1
BEGIN
  IF DATABASE_PRINCIPAL_ID('lms_app') IS NULL
    EXEC ('CREATE ROLE lms_app AUTHORIZATION dbo');
  EXEC ('GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO lms_app');
  EXEC ('DENY UPDATE, DELETE ON dbo.admin_audit_log TO lms_app');
END
ELSE
  PRINT 'Skipped lms_app role: run api/scripts/sql/setup-lms-app-role.sql as a database owner.';
GO
