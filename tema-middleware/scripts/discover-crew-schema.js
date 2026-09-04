// One-off READ-ONLY schema discovery for crew/company + SR filter columns.
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
  const pool = await new sql.ConnectionPool(config).connect();

  async function cols(schema, table) {
    const r = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ` +
        `WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`,
    );
    console.log(`\n=== ${schema}.${table} (${r.recordset.length} cols) ===`);
    console.log(r.recordset.map((c) => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(', '));
  }

  try {
    await cols('FSM', 'XTECHNCN');
    await cols('FSM', 'XCREW');
    // Confirm the SR filter columns exist.
    const sr = await pool.request().query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS ` +
        `WHERE TABLE_SCHEMA='FSM' AND TABLE_NAME='SERREQUEST' ` +
        `AND COLUMN_NAME IN ('SALFCY_0','SRERESDAT_0','SRENUM_0')`,
    );
    console.log('\n=== SERREQUEST filter cols present ===');
    console.log(sr.recordset.map((c) => c.COLUMN_NAME).join(', '));
    console.log('\nDISCOVERY_OK');
  } catch (e) {
    console.log('DISCOVERY_FAIL:', e.code || '', e.message);
  } finally {
    await pool.close();
  }
})();
