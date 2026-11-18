-- 006_live_lessons: a module can hold live lessons (contents.type = 'live') linked to a live class.

IF COL_LENGTH('dbo.contents', 'live_class_id') IS NULL
  ALTER TABLE dbo.contents ADD live_class_id INT NULL;
GO
IF COL_LENGTH('dbo.live_classes', 'reminder2_sent_at') IS NULL
  ALTER TABLE dbo.live_classes ADD reminder2_sent_at DATETIME2(3) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contents_live_class')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT FK_contents_live_class
    FOREIGN KEY (live_class_id) REFERENCES dbo.live_classes(live_class_id);
GO
-- One live class belongs to at most one lesson. Also serves as the FK index.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_contents_live_class')
  CREATE UNIQUE INDEX UQ_contents_live_class ON dbo.contents (live_class_id) WHERE live_class_id IS NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_type'
           AND definition NOT LIKE '%live%')
  ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_type;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_type')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT CK_contents_type
    CHECK (type IN ('video','pdf','link','live'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_source'
           AND definition NOT LIKE '%live%')
  ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_source;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_source')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT CK_contents_source CHECK (
    (type = 'link' AND url IS NOT NULL) OR
    (type = 'pdf' AND file_key IS NOT NULL) OR
    (type = 'video' AND ((video_source = 'upload' AND file_key IS NOT NULL) OR (video_source <> 'upload' AND url IS NOT NULL))) OR
    (type = 'live' AND live_class_id IS NOT NULL AND (
      video_source IS NULL OR
      (video_source = 'upload' AND file_key IS NOT NULL) OR
      (video_source <> 'upload' AND url IS NOT NULL)))
  );
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_live_link')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT CK_contents_live_link
    CHECK (live_class_id IS NULL OR type = 'live');
GO

-- Second reminder lookup (live lessons get 60 and 15 minute reminders).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lc_reminder2')
  CREATE INDEX IX_lc_reminder2 ON dbo.live_classes (starts_at) WHERE reminder2_sent_at IS NULL AND status = 'scheduled';
GO
