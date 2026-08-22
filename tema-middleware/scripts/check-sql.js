// One-off connectivity check (read-only). Mirrors SqlServerAdapter config.
const sql = require('mssql');

(async () => {
  const config = {
    server: process.env.SQL_SERVER_HOST,
    port: Number(process.env.SQL_SERVER_PORT),
    database: process.env.SQL_SERVER_DATABASE,
    user: process.env.SQL_SERVER_USER,
    password: process.env.SQL_SERVER_PASSWORD,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    options: { encrypt: true, trustServerCertificate: true },
  };
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const ping = await pool.request().query('SELECT 1 AS ok');
    console.log('SELECT 1 ->', JSON.stringify(ping.recordset));
    // Read-only existence/permission check on FSM.XTECHNCN (no rows returned).
    try {
      const t = await pool
        .request()
        .query('SELECT COUNT(*) AS cnt FROM FSM.XTECHNCN');
      console.log('FSM.XTECHNCN reachable, row count =', t.recordset[0].cnt);
    } catch (e) {
      console.log('FSM.XTECHNCN check FAILED:', e.code || '', e.message);
    }
    await pool.close();
    console.log('SQL_OK');
  } catch (e) {
    console.log('SQL_FAIL:', e.code || '', e.message);
    process.exit(2);
  }
})();
