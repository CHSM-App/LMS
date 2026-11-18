-- 007_optional_meet_link: a live class can be scheduled before its Meet link exists.
-- The teacher adds the link later; students get it only in the join window.

IF COLUMNPROPERTY(OBJECT_ID('dbo.live_classes'), 'meet_link', 'AllowsNull') = 0
  ALTER TABLE dbo.live_classes ALTER COLUMN meet_link VARCHAR(300) NULL;
GO
