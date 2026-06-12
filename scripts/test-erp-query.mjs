// Quick validation of the ERP sync queries (read-only). Run: node scripts/test-erp-query.mjs
import sql from "mssql";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#") && !l.trim().startsWith("*"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const pool = await new sql.ConnectionPool({
  server: env.MSSQL_MANILAL_HOST,
  port: Number(env.MSSQL_MANILAL_PORT),
  user: env.MSSQL_MANILAL_USER,
  password: env.MSSQL_MANILAL_PASSWORD,
  database: env.MSSQL_MANILAL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  requestTimeout: 120000,
}).connect();

console.log("connected");

// Stage 1: vessels with ETD in window (vsl_portdtls is small)
const t0 = Date.now();
const vres = await pool.request().input("pastDays", 45).input("futureDays", 120).query(`
SET DATEFORMAT dmy;
SELECT DISTINCT RTRIM(vsl_rtno) AS vsl_rtno
FROM vsl_portdtls
WHERE ISDATE(etd) = 1
  AND CONVERT(date, etd, 103) BETWEEN DATEADD(day, -@pastDays, GETDATE()) AND DATEADD(day, @futureDays, GETDATE());`);
const rtnos = vres.recordset.map((r) => r.vsl_rtno).filter(Boolean);
console.log(`stage1 vessels in window: ${rtnos.length} (${Date.now() - t0}ms)`);

const rtnoList = rtnos.map((x) => `'${x.replace(/'/g, "''")}'`).join(",");

// Stage 2: jobs on those vessels
const t1 = Date.now();
const jres = await pool.request().query(`
SELECT
  RTRIM(m.exptno) AS exptno, RTRIM(m.expt_ldgport) AS expt_ldgport, RTRIM(m.expt_pod) AS expt_pod,
  RTRIM(m.expt_vessel) AS expt_vessel, RTRIM(m.expt_invno) AS expt_invno,
  RTRIM(m.expt_noofpkgs) AS expt_noofpkgs, RTRIM(m.expt_noofpcs) AS expt_noofpcs,
  RTRIM(m.expt_grwt) AS expt_grwt, RTRIM(m.expt_netwt) AS expt_netwt, RTRIM(m.expt_volume) AS expt_volume,
  RTRIM(m.expt_blno) AS expt_blno, RTRIM(m.expt_bldt) AS expt_bldt,
  RTRIM(m.expt_hblno) AS expt_hblno, RTRIM(m.expt_shipbillno) AS expt_shipbillno,
  RTRIM(m.arrivaldt) AS arrivaldt, RTRIM(m.deliverydt) AS deliverydt, RTRIM(m.citycode) AS citycode,
  RTRIM(e.exp_name) AS shipper_name, RTRIM(c.con_name) AS consignee_name, RTRIM(c.con_email) AS consignee_email,
  RTRIM(v.vsl_name) AS vsl_name, RTRIM(v.vsl_voyno) AS vsl_voyno,
  RTRIM(pd.etd) AS pol_etd, RTRIM(pd.eta) AS pol_eta, RTRIM(pd.sailing) AS pol_sailing, RTRIM(pd.carting) AS pol_carting,
  RTRIM(pd2.eta) AS pod_eta,
  RTRIM(ct.cartedon) AS gate_in_dt, RTRIM(ct.remark) AS gate_in_place
FROM expt_master m
LEFT JOIN exp_master e ON e.exp_code = m.expt_exporter
LEFT JOIN consignee_master c ON c.con_code = m.expt_consignee
LEFT JOIN vsl_master v ON v.vsl_rtno = m.expt_vessel
LEFT JOIN vsl_portdtls pd ON pd.vsl_rtno = m.expt_vessel AND pd.port = m.expt_ldgport
LEFT JOIN vsl_portdtls pd2 ON pd2.vsl_rtno = m.expt_vessel AND pd2.port = m.expt_pod
OUTER APPLY (
  SELECT TOP 1 x.cartedon, x.remark FROM expt_carting x WHERE x.exptno = m.exptno ORDER BY x.cartingid DESC
) ct
WHERE m.expt_mode = 'sea'
  AND RTRIM(m.expt_vessel) IN (${rtnoList});`);
console.log(`stage2 jobs on window vessels: ${jres.recordset.length} (${Date.now() - t1}ms)`);
console.log("  sample:", JSON.stringify(jres.recordset[0], null, 1)?.slice(0, 900));

// Stage 3: recent vessel-less jobs
const t2 = Date.now();
const nres = await pool.request().query(`
SELECT TOP 300
  RTRIM(m.exptno) AS exptno, RTRIM(m.expt_ldgport) AS expt_ldgport, RTRIM(m.expt_pod) AS expt_pod,
  RTRIM(m.expt_vessel) AS expt_vessel,
  RTRIM(e.exp_name) AS shipper_name, RTRIM(c.con_name) AS consignee_name
FROM expt_master m
LEFT JOIN exp_master e ON e.exp_code = m.expt_exporter
LEFT JOIN consignee_master c ON c.con_code = m.expt_consignee
WHERE m.expt_mode = 'sea'
  AND (m.expt_vessel IS NULL OR LTRIM(RTRIM(m.expt_vessel)) = '')
  AND m.id > (SELECT MAX(id) - 1500 FROM expt_master)
ORDER BY m.id DESC;`);
console.log(`stage3 vessel-less recent jobs: ${nres.recordset.length} (${Date.now() - t2}ms)`);

// Stage 4: containers + orders for first 500 jobs
const exptnos = jres.recordset.slice(0, 500).map((j) => `'${j.exptno.replace(/'/g, "''")}'`).join(",");
if (exptnos) {
  const t3 = Date.now();
  const cont = await pool.request().query(`
SELECT cn.containerid, RTRIM(cn.expt_vessel) AS expt_vessel, RTRIM(cn.containerno) AS containerno,
  RTRIM(cn.containersize) AS containersize, RTRIM(cn.containerstatus) AS containerstatus,
  RTRIM(cn.agtsealno) AS agtsealno, RTRIM(cn.custsealno) AS custsealno,
  RTRIM(cn.BOOK_CARR_NBR) AS book_carr_nbr, RTRIM(j.exptno) AS exptno
FROM expt_container1 j
JOIN expt_container cn ON cn.containerid = CAST(LTRIM(RTRIM(j.containerid)) AS int)
WHERE RTRIM(j.exptno) IN (${exptnos});`);
  console.log(`stage4 containers: ${cont.recordset.length} (${Date.now() - t3}ms)`);
  console.log("  sample:", JSON.stringify(cont.recordset[0]));

  const t4 = Date.now();
  const ord = await pool.request().query(`
SELECT RTRIM(exptno) AS exptno, RTRIM(orderno) AS orderno FROM expt_orderno WHERE RTRIM(exptno) IN (${exptnos});`);
  console.log(`stage5 orders: ${ord.recordset.length} (${Date.now() - t4}ms)`);
}

await pool.close();
console.log("done");
