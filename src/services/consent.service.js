const { query, T } = require('../db/query');

async function record({ userId = null, mobile, type, ip }, tx) {
  await query(
    `INSERT INTO dbo.legal_consents (user_id, mobile, consent_type, policy_version, ip) VALUES (@u, @m, @t, @v, @ip)`,
    {
      u: T.int(userId),
      m: T.varchar(mobile, 20),
      t: T.varchar(type, 20),
      v: T.varchar(process.env.POLICY_VERSION || '1.0', 10),
      ip: T.varchar(ip || null, 45),
    },
    tx,
  );
}

// Attach consents given before the account existed (e.g. at registration) to the new user.
async function linkToUser(mobile, userId, tx) {
  await query('UPDATE dbo.legal_consents SET user_id = @u WHERE mobile = @m AND user_id IS NULL', { u: T.int(userId), m: T.varchar(mobile, 20) }, tx);
}

module.exports = { record, linkToUser };
