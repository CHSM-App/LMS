-- 009_exam_allow_late: the teacher chooses per exam whether students may start it after its End date (due date).
-- 1 (default, also for existing exams) = allowed, the attempt is shown as Late. 0 = closed after the End date.

IF COL_LENGTH('dbo.exams', 'allow_late') IS NULL
  ALTER TABLE dbo.exams ADD allow_late BIT NOT NULL CONSTRAINT DF_exams_allow_late DEFAULT 1;
GO
