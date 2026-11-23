-- 011_live_lesson_template: a live lesson can be added with only a title (no live class yet, no recording).

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_source'
           AND definition NOT LIKE '%[[]live_class_id] IS NULL AND [[]video_source] IS NULL%')
  ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_source;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_source')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT CK_contents_source CHECK (
    (type = 'link' AND url IS NOT NULL) OR
    (type = 'pdf' AND file_key IS NOT NULL) OR
    (type = 'video' AND ((video_source = 'upload' AND file_key IS NOT NULL) OR (video_source <> 'upload' AND url IS NOT NULL))) OR
    (type = 'live' AND live_class_id IS NULL AND video_source IS NULL AND live_slot_id IS NOT NULL) OR
    (type = 'live' AND live_class_id IS NOT NULL AND (
      video_source IS NULL OR
      (video_source = 'upload' AND file_key IS NOT NULL) OR
      (video_source <> 'upload' AND url IS NOT NULL)))
  );
GO
