// Dev seed: super admin from SEED_ADMIN_MOBILE plus one pending teacher request.
// Idempotent: re-running does not duplicate rows. Later phases extend this file.
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { one, query, T } = require('../src/db/query');
const { closePool } = require('../src/db/pool');
const { normalizeMobile } = require('../src/utils/mobile');

async function upsertUser({ mobile, name, role, status = 'approved' }) {
  const existing = await one('SELECT * FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(mobile, 20) });
  if (existing) return existing;
  return one(
    "INSERT INTO dbo.users (mobile, name, role, status, whatsapp_opt_in) OUTPUT INSERTED.* VALUES (@m, @n, @r, @s, 1)",
    { m: T.varchar(mobile, 20), n: T.nvarchar(name, 120), r: T.varchar(role, 10), s: T.varchar(status, 10) },
  );
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Do not seed production');
  const adminMobile = normalizeMobile(process.env.SEED_ADMIN_MOBILE || '');
  if (!adminMobile) throw new Error('Set SEED_ADMIN_MOBILE to a valid Indian mobile number');
  const admin = await upsertUser({ mobile: adminMobile, name: process.env.SEED_ADMIN_NAME || 'Super Admin', role: 'admin' });
  console.log(`admin: ${admin.mobile}`);

  const pending = await one("SELECT request_id FROM dbo.teacher_requests WHERE mobile = '+919999900001'");
  if (!pending) {
    await query(
      `INSERT INTO dbo.teacher_requests (mobile, name, course_name, subject, experience_years, city, qualification)
       VALUES ('+919999900001', N'सुरेश पाटील', N'Class 10 Maths (SSC)', N'Maths', 8, N'Pune', N'M.Sc. B.Ed.')`,
    );
    console.log('pending teacher request: +919999900001');
  }
  if (require.main === module) {
    try {
      // Later phases register extra seeders here.
      // eslint-disable-next-line global-require
      const extra = require('./seed-demo');
      await extra.seedDemo({ admin });
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
}

module.exports = { seed, upsertUser };

if (require.main === module) {
  seed()
    .then(() => console.log('Seed complete. Log in with any seeded mobile; OTP prints in the API console.'))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}
