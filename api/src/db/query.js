const { sql, getPool } = require('./pool');

// Typed parameter builders: always declare SQL types (see guidelines/mssql.md).
const T = {
  int: (v) => [sql.Int, v],
  bigint: (v) => [sql.BigInt, v],
  bit: (v) => [sql.Bit, v === null || v === undefined ? v : v ? 1 : 0],
  tinyint: (v) => [sql.TinyInt, v],
  decimal: (v, p = 9, s = 2) => [sql.Decimal(p, s), v],
  nvarchar: (v, n) => [n ? sql.NVarChar(n) : sql.NVarChar(sql.MAX), v],
  varchar: (v, n) => [n ? sql.VarChar(n) : sql.VarChar(sql.MAX), v],
  char: (v, n) => [sql.Char(n), v],
  date: (v) => [sql.Date, v],
  datetime: (v) => [sql.DateTime2(3), v],
  uuid: (v) => [sql.UniqueIdentifier, v],
  varbinary: (v) => [sql.VarBinary(sql.MAX), v],
};

async function request(tx) {
  if (tx) return new sql.Request(tx);
  return (await getPool()).request();
}

// query(text, { name: T.int(5) }, tx) -> recordset
async function query(text, params = {}, tx) {
  const r = await request(tx);
  for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value === undefined ? null : value);
  const res = await r.query(text);
  return res.recordset || [];
}

async function one(text, params, tx) {
  const rows = await query(text, params, tx);
  return rows[0] || null;
}

// For statements returning several result sets.
async function multi(text, params = {}, tx) {
  const r = await request(tx);
  for (const [name, [type, value]] of Object.entries(params)) r.input(name, type, value === undefined ? null : value);
  const res = await r.query(text);
  return res.recordsets;
}

module.exports = { T, query, one, multi, sql };
