// Validates the EXACT Phase 3.5 login query against the real table using a
// bogus username -> 0 rows. Proves the column names/query are valid without
// fetching any real password (XPASSWRD_0 selected but no row is returned).
const sql = require('mssql');
(async () => {
  const config = {
    server: process.env.SQL_SERVER_HOST,
    port: Number(process.env.SQL_SERVER_PORT),
    database: process.env.SQL_SERVER_DATABASE,
    user: process.env.SQL_SERVER_USER,
    password: process.env.SQL_SERVER_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
  };
  const s = process.env.SQL_TECHNICIAN_SCHEMA;
  const t = process.env.SQL_TECHNICIAN_TABLE;
  const u = process.env.SQL_TECHNICIAN_USERNAME_COLUMN;
  const text =
    `SELECT XTECH_0, [${u}] AS XTECHNCN_0, XPASSWRD_0, XLEADTECH_0 ` +
    `FROM [${s}].[${t}] WHERE [${u}] = @username`;
  const pool = await new sql.ConnectionPool(config).connect();
  const r = await pool
    .request()
    .input('username', '__no_such_user__')
    .query(text);
  console.log('QUERY_VALID rows=', r.recordset.length, '(expected 0)');
  await pool.close();
})().catch((e) => { console.log('QUERY_FAIL', e.code || '', e.message); process.exit(2); });
