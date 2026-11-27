-- 013_demo_request_email: the visitor's email on a live demo request (required for new requests, NULL on older ones).
IF COL_LENGTH('dbo.demo_requests', 'email') IS NULL
  ALTER TABLE dbo.demo_requests ADD email VARCHAR(160) NULL;
GO
