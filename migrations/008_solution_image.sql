-- 008_solution_image: a question can carry a photo of the worked solution (e.g. a maths sum solved on paper).
-- Students see it next to the explanation in the answer review. Uploaded through POST /uploads with kind 'solution'.

IF COL_LENGTH('dbo.questions', 'explanation_image_key') IS NULL
  ALTER TABLE dbo.questions ADD explanation_image_key VARCHAR(200) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_upload_kind')
  ALTER TABLE dbo.upload_sessions DROP CONSTRAINT CK_upload_kind;
GO
ALTER TABLE dbo.upload_sessions ADD CONSTRAINT CK_upload_kind
  CHECK (kind IN ('thumbnail','photo','pdf','video','demo_video','solution'));
GO
