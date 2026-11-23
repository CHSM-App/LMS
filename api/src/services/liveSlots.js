// A live lesson has one contents row per batch session; rows of one lesson share live_slot_id.
// Lists and counts that show each lesson once keep only the first row of a slot.
const firstOfSlotSql = (alias = 'x') => `(${alias}.live_slot_id IS NULL
  OR ${alias}.content_id = (SELECT MIN(s1.content_id) FROM dbo.contents s1 WHERE s1.live_slot_id = ${alias}.live_slot_id))`;

// Is the live class (alias l) for this batch? Its own batch; or all batches, unless the batch has its own
// session of the same lesson, which replaces the all-batches one for that batch.
const ownSessionSql = (l, batchExpr) => `EXISTS (SELECT 1 FROM dbo.contents s2
  JOIN dbo.contents s3 ON s3.live_slot_id = s2.live_slot_id
  JOIN dbo.live_classes s4 ON s4.live_class_id = s3.live_class_id
  WHERE s2.live_class_id = ${l}.live_class_id AND s4.batch_id = ${batchExpr})`;
const forBatchSql = (l, batchExpr) => `(${l}.batch_id = ${batchExpr} OR (${l}.batch_id IS NULL AND NOT ${ownSessionSql(l, batchExpr)}))`;
// Same, for attendance: a replaced class the student did have a record for still counts.
const heldForSql = (l, batchExpr, studentExpr) => `(${forBatchSql(l, batchExpr)} OR (${l}.batch_id IS NULL
  AND EXISTS (SELECT 1 FROM dbo.attendance s5 WHERE s5.live_class_id = ${l}.live_class_id AND s5.student_id = ${studentExpr})))`;

module.exports = { firstOfSlotSql, forBatchSql, heldForSql };
