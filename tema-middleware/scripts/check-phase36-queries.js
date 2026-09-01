// Validates the Phase 3.6 read queries against the real schema. Sales-rep query
// uses a bogus username (0 rows) so NO password (XPWSD_0) is ever returned.
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
  const s = process.env.SQL_FSM_SCHEMA || 'FSM';
  const pool = await new sql.ConnectionPool(config).connect();
  const run = async (label, text, params = {}) => {
    const req = pool.request();
    Object.entries(params).forEach(([k, v]) => req.input(k, v));
    const r = await req.query(text);
    console.log(`${label}: OK rows=${r.recordset.length}`);
  };
  try {
    await run('salesRep(user,bogus)',
      `SELECT XAUS_0, XPWSD_0, XAUSNA_0, XEMAILID_0, XACT_0, XUSROLE_0 FROM [${s}].[XX10CUSERS] WHERE XAUS_0 = @u`,
      { u: '__none__' });
    await run('salesRep(sites,bogus)',
      `SELECT XFCY_0, XDEFFCY_0 FROM [${s}].[XX10CUSERD] WHERE XAUS_0 = @u ORDER BY XLINNO_0`, { u: '__none__' });
    await run('serviceRequests(header)',
      `SELECT TOP 1 SRENUM_0, SREDES_0, XSTATUS_0, XSRDATE_0, CREDAT_0, SREBPC_0, XBPAADDLIG_0, XCTY_0, XPOSCOD_0, XCRY_0, XDRN_0 FROM [${s}].[SERREQUEST] ORDER BY SRENUM_0 DESC`);
    await run('sr.bases(bogus)',
      `SELECT XLINUM_0, XCPNITM_0, XCPNTMDES_0, XCPNQTY_0, XUOM_0, XMACNUM_0, XMACSERNUM_0 FROM [${s}].[XFSMBASE] WHERE XSERNUM_0 = @id`, { id: '__none__' });
    await run('sr.tasks(bogus)',
      `SELECT HDTNUM_0, HDTTYP_0, HDTITM_0, HDTQTY_0, HDTUOM_0, HDTAUS_0, HDTPLNDAT_0, HDTDONDAT_0 FROM [${s}].[HDKTASK] WHERE SRENUM_0 = @id`, { id: '__none__' });
    await run('sr.jobcards(bogus)',
      `SELECT XJOBCARD_0, XTECH_0, XBASE_0, XDRN_0, XSTRDATE_0, XSTRTIME_0, XENDDATE_0, XENDTIME_0, XTYPE_0, XDURATION_0 FROM [${s}].[X1CJOBCARD] WHERE XSRENUM_0 = @id`, { id: '__none__' });
    await run('routes(header)',
      `SELECT TOP 1 XDRN_0, XROUTSTATUS_0, XROUTDATE_0, XTECHID_0, XTECHNAM_0, XSITE_0, XTRIP_0, XBYUSER_0 FROM [${s}].[XX1ROUTPOH] ORDER BY XROUTDATE_0 DESC`);
    await run('routes.detail(bogus)',
      `SELECT XDRN_0, XDRNLIN_0, XDOCNUM_0, XBPCORD_0, XBPNAME_0, XSTATUS_0, XSERNUM_0, XETA_0, XETD_0, XSHIDAT_0, XDLVDAT_0, XBPAADDLIG_0, XCTY_0, XPOSCOD_0, XCRY_0 FROM [${s}].[XX1ROUTPOD] WHERE XDRN_0 = @x ORDER BY XDRNLIN_0`, { x: '__none__' });
    console.log('ALL_QUERIES_VALID');
    await pool.close();
  } catch (e) {
    console.log('QUERY_FAIL', e.code || '', e.message);
    process.exit(2);
  }
})();
