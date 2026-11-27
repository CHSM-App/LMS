-- 010_live_slots: the sessions (one per batch) of one live lesson share one live_slot_id.

IF COL_LENGTH('dbo.contents', 'live_slot_id') IS NULL
  ALTER TABLE dbo.contents ADD live_slot_id UNIQUEIDENTIFIER NULL;
GO

-- Every existing live lesson becomes its own slot.
UPDATE dbo.contents SET live_slot_id = NEWID() WHERE type = 'live' AND live_slot_id IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_contents_live_slot')
  CREATE INDEX IX_contents_live_slot ON dbo.contents (live_slot_id) WHERE live_slot_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_contents_live_slot')
  ALTER TABLE dbo.contents WITH CHECK ADD CONSTRAINT CK_contents_live_slot
    CHECK (live_slot_id IS NULL OR type = 'live');
GO
