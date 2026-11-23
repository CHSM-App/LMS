// A live lesson has one contents row per batch session; rows of one lesson share live_slot_id.
// Lists and counts that show each lesson once keep only the first row of a slot.
const firstOfSlotSql = (alias = 'x') => `(${alias}.live_slot_id IS NULL
  OR ${alias}.content_id = (SELECT MIN(s1.content_id) FROM dbo.contents s1 WHERE s1.live_slot_id = ${alias}.live_slot_id))`;

module.exports = { firstOfSlotSql };
