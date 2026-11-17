const { query, T } = require('../db/query');

// Append-only admin audit trail. Always call inside the same transaction as the change.
async function audit({ adminId, action, entityType, entityId, before, after, ip }, tx) {
  await query(
    `INSERT INTO dbo.admin_audit_log (admin_id, action, entity_type, entity_id, before_json, after_json, ip)
     VALUES (@a, @act, @et, @eid, @b, @af, @ip)`,
    {
      a: T.int(adminId),
      act: T.varchar(action, 40),
      et: T.varchar(entityType, 30),
      eid: T.int(entityId ?? null),
      b: T.nvarchar(before ? JSON.stringify(before) : null),
      af: T.nvarchar(after ? JSON.stringify(after) : null),
      ip: T.varchar(ip || null, 45),
    },
    tx,
  );
}

module.exports = { audit };
