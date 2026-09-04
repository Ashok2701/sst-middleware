// READ-ONLY live validation of the new Phase-3.9 queries (no writes/DDL).
const sql = require('mssql');

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SQL_SERVER_HOST,
    port: Number(process.env.SQL_SERVER_PORT),
    database: process.env.SQL_SERVER_DATABASE,
    user: process.env.SQL_SERVER_USER,
    password: process.env.SQL_SERVER_PASSWORD,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();

  async function run(label, text, params = {}) {
    const r = pool.request();
    for (const [k, v] of Object.entries(params)) r.input(k, v);
    try {
      const res = await r.query(text);
      console.log(`OK  ${label}: rows=${res.recordset.length}`);
    } catch (e) {
      console.log(`ERR ${label}: ${e.message}`);
    }
  }

  // Companies list + by site.
  await run('companies.list', 'SELECT TOP (1) XCREWID_0, XCRENAM_0, XFCY_0, XACTIVE_0 FROM FSM.XCREW ORDER BY XCREWID_0');
  await run('companies.bySite', 'SELECT TOP (1) XCREWID_0, XCRENAM_0, XFCY_0, XACTIVE_0 FROM FSM.XCREW WHERE XFCY_0 = @site ORDER BY XCREWID_0', { site: 'ZZZZ' });
  // Company detail + technicians join.
  await run('company.byId', 'SELECT XCREWID_0, XCRENAM_0, XFCY_0, XACTIVE_0 FROM FSM.XCREW WHERE XCREWID_0 = @id', { id: 'ZZZZ' });
  await run('company.technicians', 'SELECT XTECH_0, XTECHNAM_0, XLEADTECH_0, XSKLTYP_0, XCRTFCN_0, XEMAIL_0 FROM FSM.XTECHNCN WHERE XCREWID_0 = @id ORDER BY XTECH_0', { id: 'ZZZZ' });
  // SR date + site filter.
  await run('sr.dateSite', 'SELECT TOP (1) SRENUM_0, SALFCY_0, SRERESDAT_0 FROM FSM.SERREQUEST WHERE SALFCY_0 = @site AND CAST(SRERESDAT_0 AS DATE) = @date ORDER BY SRENUM_0 DESC', { site: 'ZZZZ', date: '2026-06-01' });
  // Technician login row now also selects name + crew id.
  await run('tech.loginRow', 'SELECT XTECH_0, XTECH_0 AS XTECHNCN_0, XTECHNAM_0, XCREWID_0, XPASSWRD_0, XLEADTECH_0 FROM FSM.XTECHNCN WHERE XTECH_0 = @u', { u: 'ZZZZ' });

  await pool.close();
  console.log('VALIDATION_DONE');
})();
