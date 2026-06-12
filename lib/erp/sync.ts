import { createClient } from "@supabase/supabase-js";
import { getErpPool } from "./db";
import type { AiropsJobData } from "@/lib/types/airops";

// ─────────────────────────────────────────────────────────────────────────────
// ERP → Supabase sync (read-only against MSSQL, upserts into Supabase).
//
// Source of truth: legacy Manilal ERP (MSSQL `manilal` db).
// Keys:
//   job        → expt_master.exptno        → airops_jobs.data->>'erp_exp_number'
//   vessel     → vsl_master.vsl_rtno       → airops_vessels.erp_rtno
//   container  → expt_container.containerid→ airops_containers.erp_key
//
// All user-entered ERP dates are VARCHAR 'DD/MM/YYYY'.
// ─────────────────────────────────────────────────────────────────────────────

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// ---------- helpers ----------

function ddmmyyyyToIso(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  if (yyyy === "1900") return null; // legacy default
  return `${yyyy}-${mm}-${dd}`;
}

// datetime columns arrive as JS Dates from the driver; varchar dates as DD/MM/YYYY
function anyToIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900) return null;
    return v.toISOString().slice(0, 10);
  }
  return ddmmyyyyToIso(v);
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

// ---------- ERP row shapes ----------

interface ErpJobRow {
  exptno: string;
  expt_ldgport: string | null;
  expt_pod: string | null;
  expt_vessel: string | null;
  expt_invno: string | null;
  expt_noofpkgs: string | null;
  expt_noofpcs: string | null;
  expt_grwt: string | null;
  expt_netwt: string | null;
  expt_volume: string | null;
  expt_blno: string | null;
  expt_bldt: string | null;
  expt_hblno: string | null;
  expt_hbldt: string | null;
  expt_shipbillno: string | null;
  expt_shipbilldt: string | null;
  arrivaldt: string | null;
  deliverydt: string | null;
  citycode: string | null;
  shipper_name: string | null;
  consignee_name: string | null;
  consignee_email: string | null;
  vsl_name: string | null;
  vsl_voyno: string | null;
  pol_etd: string | null;
  pol_eta: string | null;
  pol_sailing: string | null;
  pol_carting: string | null;
  pod_eta: string | null;
  gate_in_dt: string | null;
  gate_in_place: string | null;
}

interface ErpContainerRow {
  containerid: number;
  expt_vessel: string | null;
  containerno: string | null;
  containersize: string | null;
  containerstatus: string | null;
  agtsealno: string | null;
  custsealno: string | null;
  book_carr_nbr: string | null;
  ata: unknown;
  exptno: string;
}

interface ErpOrderRow {
  exptno: string;
  orderno: string | null;
}

// France import side (MP Cargo France) — console + dossier observations
interface ErpFranceRow {
  exptno: string;
  hawbno: string | null;
  jobno: string | null;
  consoleno: string | null;
  releasedt: unknown;
  douaneno: string | null;
  douanedt: unknown;
  req_rdv: unknown;
  conf_rdv: unknown;
  odt: unknown;
  instr_douane: unknown;
  t1_recvd: unknown;
  t1_sent: unknown;
  shpline_invdt: unknown;
  rel_print: unknown;
  rel_sent: unknown;
  pincode: string | null;
  do_pin_trans: unknown;
  j_req_rdv: unknown;
  j_conf_rdv: unknown;
  j_odt: unknown;
  j_instr: unknown;
  t1_no: string | null;
  t1_dt: unknown;
}

interface ErpArrivalRow {
  expt_vessel: string;
  destination: string | null;
  actualarrivaldt: unknown;
}

// ---------- status inference ----------
// Forward-only ladder from India-side ERP signals. Names must match
// airops_statuses.name (case-insensitive). France-side stages (RDV, ODT, …)
// are managed manually in the dashboard and never downgraded by sync.

function inferStatusName(
  j: ErpJobRow,
  jobContainers: ErpContainerRow[],
  fr: ErpFranceRow | undefined,
  ata: string | null
): string {
  // France-side rungs (latest first)
  if (fr) {
    if (str(fr.t1_no) || anyToIso(fr.t1_recvd) || anyToIso(fr.t1_sent)) return "T1/IMA";
    if (ata || ddmmyyyyToIso(j.arrivaldt)) return "ATA";
    if (str(fr.pincode)) return "CPU/SCR";
    if (anyToIso(fr.rel_sent) || anyToIso(fr.rel_print)) return "Arrival Notice";
    if (anyToIso(fr.shpline_invdt)) return "FACTURE";
    if (anyToIso(fr.j_instr) || anyToIso(fr.instr_douane)) return "Instructions Douane";
    if (anyToIso(fr.j_odt) || anyToIso(fr.odt)) return "ODT";
    if (anyToIso(fr.j_conf_rdv) || anyToIso(fr.j_req_rdv) || anyToIso(fr.conf_rdv) || anyToIso(fr.req_rdv)) return "RDV";
    if (anyToIso(fr.releasedt) || anyToIso(fr.do_pin_trans)) return "Container Release";
  }
  // India-side rungs
  if (ddmmyyyyToIso(j.deliverydt)) return "Completed";
  if (ddmmyyyyToIso(j.arrivaldt) || ata) return "ATA";
  if (ddmmyyyyToIso(j.pol_sailing)) return "ETA"; // sailed → in transit
  if (str(j.expt_blno) || str(j.expt_hblno)) return "Bill of Lading";
  if (ddmmyyyyToIso(j.gate_in_dt)) return "Gate In";
  if (str(j.expt_shipbillno)) return "Clearance";
  if (jobContainers.some((c) => str(c.book_carr_nbr))) return "Carrier Booking";
  if (jobContainers.length > 0) return "Container Planning";
  if (str(j.expt_vessel)) return "Vessel Planning";
  return "Booking Request";
}

// ---------- ERP queries ----------

const JOB_SELECT = `
SELECT
  RTRIM(m.exptno)            AS exptno,
  RTRIM(m.expt_ldgport)      AS expt_ldgport,
  RTRIM(m.expt_pod)          AS expt_pod,
  RTRIM(m.expt_vessel)       AS expt_vessel,
  RTRIM(m.expt_invno)        AS expt_invno,
  RTRIM(m.expt_noofpkgs)     AS expt_noofpkgs,
  RTRIM(m.expt_noofpcs)      AS expt_noofpcs,
  RTRIM(m.expt_grwt)         AS expt_grwt,
  RTRIM(m.expt_netwt)        AS expt_netwt,
  RTRIM(m.expt_volume)       AS expt_volume,
  RTRIM(m.expt_blno)         AS expt_blno,
  RTRIM(m.expt_bldt)         AS expt_bldt,
  RTRIM(m.expt_hblno)        AS expt_hblno,
  RTRIM(m.expt_hbldt)        AS expt_hbldt,
  RTRIM(m.expt_shipbillno)   AS expt_shipbillno,
  RTRIM(m.expt_shipbilldt)   AS expt_shipbilldt,
  RTRIM(m.arrivaldt)         AS arrivaldt,
  RTRIM(m.deliverydt)        AS deliverydt,
  RTRIM(m.citycode)          AS citycode,
  RTRIM(e.exp_name)          AS shipper_name,
  RTRIM(c.con_name)          AS consignee_name,
  RTRIM(c.con_email)         AS consignee_email,
  RTRIM(v.vsl_name)          AS vsl_name,
  RTRIM(v.vsl_voyno)         AS vsl_voyno,
  RTRIM(pd.etd)              AS pol_etd,
  RTRIM(pd.eta)              AS pol_eta,
  RTRIM(pd.sailing)          AS pol_sailing,
  RTRIM(pd.carting)          AS pol_carting,
  RTRIM(pd2.eta)             AS pod_eta,
  RTRIM(ct.cartedon)         AS gate_in_dt,
  RTRIM(ct.remark)           AS gate_in_place
FROM expt_master m
LEFT JOIN exp_master e        ON e.exp_code = m.expt_exporter
LEFT JOIN consignee_master c  ON c.con_code = m.expt_consignee
LEFT JOIN vsl_master v        ON v.vsl_rtno = m.expt_vessel
LEFT JOIN vsl_portdtls pd     ON pd.vsl_rtno = m.expt_vessel AND pd.port = m.expt_ldgport
LEFT JOIN vsl_portdtls pd2    ON pd2.vsl_rtno = m.expt_vessel AND pd2.port = m.expt_pod
OUTER APPLY (
  SELECT TOP 1 x.cartedon, x.remark
  FROM expt_carting x
  WHERE x.exptno = m.exptno
  ORDER BY x.cartingid DESC
) ct`;

function quoteList(values: string[]): string {
  return values.map((x) => `'${x.replace(/'/g, "''")}'`).join(",");
}

// Dummy vessels the ops team uses to park jobs before real vessel assignment
// (e.g. "MPC" with a far-future ETD). Jobs on these stay in Booking Request.
const PLACEHOLDER_VESSELS = (process.env.ERP_PLACEHOLDER_VESSELS ?? "MPC")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

export function isPlaceholderVessel(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toUpperCase();
  return !!n && PLACEHOLDER_VESSELS.includes(n);
}

async function fetchErpRows(pastDays: number) {
  const pool = await getErpPool();

  // Single pass: all current-year SEA jobs (~3k rows — cheap with simple
  // WHERE; the window filter happens in JS because ERP dates are
  // DD/MM/YYYY varchars and date-filtering the join times out).
  const res = await pool.request().query<ErpJobRow>(`${JOB_SELECT}
WHERE m.expt_mode = 'sea'
  AND SUBSTRING(RTRIM(m.exptno), 6, 2) = RIGHT(CONVERT(varchar(4), YEAR(GETDATE())), 2);`);

  // Keep a job when it has no usable ETD (backlog / placeholder vessel /
  // not scheduled) or its ETD is no older than the past window. No upper
  // bound — far-future ETDs are either real bookings or parking vessels.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - pastDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const jobs = res.recordset.filter((j) => {
    const etd = ddmmyyyyToIso(j.pol_etd);
    return !etd || etd >= cutoffIso;
  });

  // Strip placeholder vessels so their jobs read as "no vessel yet".
  for (const j of jobs) {
    if (isPlaceholderVessel(j.vsl_name)) {
      j.expt_vessel = null;
      j.vsl_name = null;
      j.vsl_voyno = null;
      j.pol_etd = null;
      j.pol_eta = null;
      j.pol_sailing = null;
      j.pol_carting = null;
      j.pod_eta = null;
    }
  }

  if (jobs.length === 0) {
    return {
      jobs,
      containers: [] as ErpContainerRow[],
      orders: [] as ErpOrderRow[],
      france: [] as ErpFranceRow[],
      arrivals: [] as ErpArrivalRow[],
    };
  }

  // Containers, buyer orders + France milestones, fetched in batches of 500 keys.
  const exptnos = jobs.map((j) => j.exptno);
  const containers: ErpContainerRow[] = [];
  const orders: ErpOrderRow[] = [];
  const france: ErpFranceRow[] = [];

  for (let i = 0; i < exptnos.length; i += 500) {
    const batch = exptnos.slice(i, i + 500);
    const inList = quoteList(batch);

    const contRes = await pool.request().query<ErpContainerRow>(`
SELECT
  cn.containerid,
  RTRIM(cn.expt_vessel)     AS expt_vessel,
  RTRIM(cn.containerno)     AS containerno,
  RTRIM(cn.containersize)   AS containersize,
  RTRIM(cn.containerstatus) AS containerstatus,
  RTRIM(cn.agtsealno)       AS agtsealno,
  RTRIM(cn.custsealno)      AS custsealno,
  RTRIM(cn.BOOK_CARR_NBR)   AS book_carr_nbr,
  cn.ATA                    AS ata,
  RTRIM(j.exptno)           AS exptno
FROM expt_container1 j
JOIN expt_container cn ON cn.containerid = CAST(LTRIM(RTRIM(j.containerid)) AS int)
WHERE RTRIM(j.exptno) IN (${inList});`);
    containers.push(...contRes.recordset);

    const ordRes = await pool.request().query<ErpOrderRow>(`
SELECT RTRIM(exptno) AS exptno, RTRIM(orderno) AS orderno
FROM expt_orderno
WHERE RTRIM(exptno) IN (${inList});`);
    orders.push(...ordRes.recordset);

    // France import side: console job → dossier observations → T1 docs.
    // Sea jobs link via HBL (console_jobdtls.hawbno = expt_hblno); the
    // exptno column is only reliably filled for air consoles.
    // TBL_IMPFRA_* tables key consoles by the last 10 chars of consoleno.
    const batchJobs = jobs.slice(i, i + 500);
    const hbls = batchJobs
      .map((bj) => str(bj.expt_hblno))
      .filter(Boolean) as string[];
    const hblClause = hbls.length
      ? ` OR RTRIM(cj.hawbno) IN (${quoteList(hbls)})`
      : "";
    const fraRes = await pool.request().query<ErpFranceRow>(`
SELECT
  RTRIM(cj.exptno)        AS exptno,
  RTRIM(cj.hawbno)        AS hawbno,
  RTRIM(cj.jobno)         AS jobno,
  RTRIM(cj.consoleno)     AS consoleno,
  cj.releasedt            AS releasedt,
  RTRIM(cj.douaneno)      AS douaneno,
  cj.douanedt             AS douanedt,
  o.REQ_RDV               AS req_rdv,
  o.CONF_RDV              AS conf_rdv,
  o.ORD_DE_TRANS          AS odt,
  o.INSTR_DOUANE          AS instr_douane,
  o.T1_RECVD              AS t1_recvd,
  o.T1_SENT               AS t1_sent,
  o.SHPLINE_INVDT         AS shpline_invdt,
  o.REL_PRINT             AS rel_print,
  o.REL_SENT              AS rel_sent,
  RTRIM(o.PINCODE)        AS pincode,
  o.DO_PIN_TRANS          AS do_pin_trans,
  jo.REQ_RDV              AS j_req_rdv,
  jo.CONF_RDV             AS j_conf_rdv,
  jo.ORD_DE_TRANS         AS j_odt,
  jo.INSTR_DOUANE         AS j_instr,
  RTRIM(t1.CUSTOM_CLEAR_NO) AS t1_no,
  t1.CUSTOM_CLEAR_DT      AS t1_dt
FROM console_jobdtls cj
LEFT JOIN TBL_IMPFRA_CONSOLE_DOSSIER_OBSERVATION o
  ON o.CONSOLENO = RIGHT(RTRIM(cj.consoleno), 10)
LEFT JOIN TBL_IMPFRA_CONSOLE_JOB_DOSSIER_OBSERVATION jo
  ON jo.JOBNO = cj.jobno
OUTER APPLY (
  SELECT TOP 1 d.CUSTOM_CLEAR_NO, d.CUSTOM_CLEAR_DT
  FROM TBL_IMPFRA_CONSOLE_CUSTOM_DOX_DET d
  WHERE d.JOBNO = cj.jobno AND d.FK_CUSTOM_DOX_TYPE = 4
  ORDER BY d.CUSTOM_CLEAR_DT DESC
) t1
WHERE RTRIM(cj.exptno) IN (${inList})${hblClause};`);
    france.push(...fraRes.recordset);
  }

  // Sea ATA per vessel rotation (expt_arrival is small).
  const rtnoSet = Array.from(
    new Set(jobs.map((j) => str(j.expt_vessel)).filter(Boolean))
  ) as string[];
  const arrivals: ErpArrivalRow[] = [];
  for (let i = 0; i < rtnoSet.length; i += 500) {
    const res = await pool.request().query<ErpArrivalRow>(`
SELECT RTRIM(expt_vessel) AS expt_vessel, RTRIM(destination) AS destination, actualarrivaldt
FROM expt_arrival
WHERE RTRIM(expt_vessel) IN (${quoteList(rtnoSet.slice(i, i + 500))});`);
    arrivals.push(...res.recordset);
  }

  return { jobs, containers, orders, france, arrivals };
}

// ---------- Supabase upserts ----------

export interface SyncResult {
  wiped: boolean;
  erpJobs: number;
  vesselsUpserted: number;
  containersUpserted: number;
  jobsInserted: number;
  jobsUpdated: number;
  jobsArchived: number;
  warnings: string[];
}

export async function runErpSync(opts: { wipe?: boolean } = {}): Promise<SyncResult> {
  const sb = admin();
  const warnings: string[] = [];
  const pastDays = Number(process.env.ERP_SYNC_ETD_PAST_DAYS ?? 45);

  // 0. optional wipe of seed/demo rows (keeps airops_statuses)
  if (opts.wipe) {
    for (const table of [
      "airops_comments",
      "airops_jobs",
      "airops_containers",
      "airops_vessels",
    ]) {
      const { error } = await sb.from(table).delete().not("id", "is", null);
      if (error) throw new Error(`wipe ${table}: ${error.message}`);
    }
  }

  // 1. pull from ERP
  const { jobs, containers, orders, france, arrivals } = await fetchErpRows(pastDays);

  // 2. statuses lookup (name → id, display_order)
  const { data: statuses, error: stErr } = await sb
    .from("airops_statuses")
    .select("id, name, display_order");
  if (stErr) throw new Error(`statuses: ${stErr.message}`);
  const statusByName = new Map(
    (statuses ?? []).map((s) => [s.name.toLowerCase(), s])
  );
  const statusOrderById = new Map((statuses ?? []).map((s) => [s.id, s.display_order]));

  // 3. vessels — distinct rtno across jobs
  const vesselMap = new Map<string, { name: string; etd: string | null; eta: string | null; pol: string | null; port_cutoff: string | null }>();
  for (const j of jobs) {
    const rt = str(j.expt_vessel);
    if (!rt || !str(j.vsl_name)) continue;
    if (!vesselMap.has(rt)) {
      const voy = str(j.vsl_voyno);
      vesselMap.set(rt, {
        name: voy ? `${str(j.vsl_name)} / ${voy}` : str(j.vsl_name)!,
        etd: ddmmyyyyToIso(j.pol_etd),
        eta: ddmmyyyyToIso(j.pod_eta) ?? ddmmyyyyToIso(j.pol_eta),
        pol: str(j.expt_ldgport) ?? null,
        port_cutoff: ddmmyyyyToIso(j.pol_carting),
      });
    }
  }

  // Prefer the erp_rtno column; degrade to name-matching if the migration
  // adding it hasn't been applied yet.
  let hasErpVesselCol = true;
  let vesselIdByRtno = new Map<string, string>();
  {
    const { data, error } = await sb
      .from("airops_vessels")
      .select("id, erp_rtno")
      .not("erp_rtno", "is", null);
    if (error) {
      hasErpVesselCol = false;
      warnings.push(
        "airops_vessels.erp_rtno missing — falling back to name matching. Run the migration in supabase/migrations."
      );
      const { data: byName, error: nameErr } = await sb
        .from("airops_vessels")
        .select("id, name");
      if (nameErr) throw new Error(`select vessels: ${nameErr.message}`);
      // fallback: key by display name (includes voyage, unique within window)
      vesselIdByRtno = new Map(
        (byName ?? []).map((v) => [`name:${v.name}`, v.id as string])
      );
    } else {
      vesselIdByRtno = new Map(
        (data ?? []).map((v) => [v.erp_rtno as string, v.id as string])
      );
    }
  }
  const vesselKey = (rtno: string, name: string) =>
    hasErpVesselCol ? rtno : `name:${name}`;

  let vesselsUpserted = 0;
  for (const [rtno, v] of vesselMap) {
    const row: Record<string, unknown> = {
      name: v.name,
      etd: v.etd,
      eta: v.eta,
      pol: v.pol,
      port_cutoff: v.port_cutoff,
    };
    if (hasErpVesselCol) row.erp_rtno = rtno;
    const existingId = vesselIdByRtno.get(vesselKey(rtno, v.name));
    if (existingId) {
      const { error } = await sb.from("airops_vessels").update(row).eq("id", existingId);
      if (error) warnings.push(`vessel ${rtno}: ${error.message}`);
      else vesselsUpserted++;
    } else {
      const { data, error } = await sb
        .from("airops_vessels")
        .insert({ ...row, canvas_x: 200 + (vesselsUpserted % 6) * 380, canvas_y: 120 })
        .select("id")
        .single();
      if (error) warnings.push(`vessel ${rtno}: ${error.message}`);
      else {
        vesselIdByRtno.set(vesselKey(rtno, v.name), data.id);
        vesselsUpserted++;
      }
    }
  }
  // resolve a vessel's supabase id from its ERP rotation number
  const resolveVesselId = (rtno: string | null | undefined): string | null => {
    const rt = str(rtno);
    if (!rt) return null;
    if (hasErpVesselCol) return vesselIdByRtno.get(rt) ?? null;
    const v = vesselMap.get(rt);
    return v ? vesselIdByRtno.get(`name:${v.name}`) ?? null : null;
  };

  // 4. containers — keyed by ERP containerid
  const containerByErpKey = new Map<string, ErpContainerRow>();
  const containersOfJob = new Map<string, ErpContainerRow[]>();
  for (const c of containers) {
    const key = String(c.containerid);
    if (!containerByErpKey.has(key)) containerByErpKey.set(key, c);
    const list = containersOfJob.get(c.exptno) ?? [];
    list.push(c);
    containersOfJob.set(c.exptno, list);
  }

  // Same degrade strategy: erp_key column preferred, container_number fallback.
  let hasErpContainerCol = true;
  let containerIdByErpKey = new Map<string, string>();
  {
    const { data, error } = await sb
      .from("airops_containers")
      .select("id, erp_key")
      .not("erp_key", "is", null);
    if (error) {
      hasErpContainerCol = false;
      warnings.push(
        "airops_containers.erp_key missing — falling back to container_number matching. Run the migration in supabase/migrations."
      );
      const { data: byNo, error: noErr } = await sb
        .from("airops_containers")
        .select("id, container_number");
      if (noErr) throw new Error(`select containers: ${noErr.message}`);
      containerIdByErpKey = new Map(
        (byNo ?? [])
          .filter((c) => c.container_number)
          .map((c) => [`no:${c.container_number}`, c.id as string])
      );
    } else {
      containerIdByErpKey = new Map(
        (data ?? []).map((c) => [c.erp_key as string, c.id as string])
      );
    }
  }
  const containerKey = (c: ErpContainerRow) =>
    hasErpContainerCol ? String(c.containerid) : `no:${str(c.containerno) ?? c.containerid}`;

  let containersUpserted = 0;
  let cIdx = 0;
  for (const [, c] of containerByErpKey) {
    const key = containerKey(c);
    const row: Record<string, unknown> = {
      vessel_id: resolveVesselId(c.expt_vessel),
      container_number: str(c.containerno) ?? null,
      container_type: [str(c.containersize), str(c.containerstatus)].filter(Boolean).join(" "),
      seal_no: [str(c.agtsealno), str(c.custsealno)].filter(Boolean).join(" / ") || null,
    };
    if (hasErpContainerCol) row.erp_key = String(c.containerid);
    const existingId = containerIdByErpKey.get(key);
    if (existingId) {
      const { error } = await sb.from("airops_containers").update(row).eq("id", existingId);
      if (error) warnings.push(`container ${key}: ${error.message}`);
      else containersUpserted++;
    } else {
      const { data, error } = await sb
        .from("airops_containers")
        .insert({ ...row, canvas_x: 150 + (cIdx % 8) * 260, canvas_y: 420 + Math.floor(cIdx / 8) * 160 })
        .select("id")
        .single();
      if (error) warnings.push(`container ${key}: ${error.message}`);
      else {
        containerIdByErpKey.set(key, data.id);
        containersUpserted++;
      }
    }
    cIdx++;
  }

  // 5a. France milestones per job — match by exptno (air) or HBL (sea)
  const franceByExptno = new Map<string, ErpFranceRow>();
  const franceByHbl = new Map<string, ErpFranceRow>();
  for (const f of france) {
    if (f.exptno && !franceByExptno.has(f.exptno)) franceByExptno.set(f.exptno, f);
    const hbl = str(f.hawbno);
    if (hbl && !franceByHbl.has(hbl)) franceByHbl.set(hbl, f);
  }
  const franceForJob = (j: ErpJobRow): ErpFranceRow | undefined => {
    const byExpt = franceByExptno.get(j.exptno);
    if (byExpt) return byExpt;
    const hbl = str(j.expt_hblno);
    return hbl ? franceByHbl.get(hbl) : undefined;
  };
  // Sea ATA: vessel-level arrivals, plus per-container ATA as fallback
  const ataByRtno = new Map<string, string>();
  for (const a of arrivals) {
    const iso = anyToIso(a.actualarrivaldt);
    if (!iso) continue;
    const prev = ataByRtno.get(a.expt_vessel);
    if (!prev || iso > prev) ataByRtno.set(a.expt_vessel, iso);
  }
  const ataByExptno = new Map<string, string>();
  for (const c of containers) {
    const iso = anyToIso(c.ata);
    if (!iso) continue;
    const prev = ataByExptno.get(c.exptno);
    if (!prev || iso > prev) ataByExptno.set(c.exptno, iso);
  }

  // 5. buyer orders per job
  const ordersOfJob = new Map<string, string[]>();
  for (const o of orders) {
    const on = str(o.orderno);
    if (!on) continue;
    const list = ordersOfJob.get(o.exptno) ?? [];
    if (!list.includes(on)) list.push(on);
    ordersOfJob.set(o.exptno, list);
  }

  // 6. jobs upsert — paginate: Supabase caps a response at 1000 rows
  const existingJobs: { id: string; status_id: string | null; data: AiropsJobData }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("airops_jobs")
      .select("id, status_id, data")
      .not("data->>erp_exp_number", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`select jobs: ${error.message}`);
    existingJobs.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const existingJobByExptno = new Map(
    existingJobs.map((j) => [(j.data as AiropsJobData).erp_exp_number as string, j])
  );

  let jobsInserted = 0;
  let jobsUpdated = 0;

  for (const j of jobs) {
    const jobContainers = containersOfJob.get(j.exptno) ?? [];
    const firstContainer = jobContainers[0];
    const containerId = firstContainer
      ? containerIdByErpKey.get(containerKey(firstContainer)) ?? null
      : null;

    const buyerOrders = ordersOfJob.get(j.exptno) ?? [];
    const fr = franceForJob(j);
    const ata =
      ataByExptno.get(j.exptno) ??
      (j.expt_vessel ? ataByRtno.get(j.expt_vessel.trim()) ?? null : null);

    const erpData: AiropsJobData = {
      erp_exp_number: j.exptno,
      order_no: j.exptno,
      buyer_order_nos: buyerOrders.length ? buyerOrders.join(", ") : undefined,
      consignee_name: str(j.consignee_name),
      consignee_email: str(j.consignee_email),
      shipper_name: str(j.shipper_name),
      quantity_pcs: num(j.expt_noofpcs),
      volume: num(j.expt_volume),
      no_of_cartons: num(j.expt_noofpkgs),
      gross_weight: num(j.expt_grwt),
      net_weight: num(j.expt_netwt),
      vessel_name: str(j.vsl_name),
      etd: ddmmyyyyToIso(j.pol_etd) ?? undefined,
      eta: ddmmyyyyToIso(j.pod_eta) ?? ddmmyyyyToIso(j.pol_eta) ?? undefined,
      pol: str(j.expt_ldgport),
      container_numbers: jobContainers.map((c) => str(c.containerno)).filter(Boolean) as string[],
      container_type: firstContainer
        ? [str(firstContainer.containersize), str(firstContainer.containerstatus)].filter(Boolean).join(" ")
        : undefined,
      seal_nos: jobContainers
        .map((c) => str(c.agtsealno) ?? str(c.custsealno))
        .filter(Boolean) as string[],
      booking_no: jobContainers.map((c) => str(c.book_carr_nbr)).find(Boolean),
      mbl_number: str(j.expt_blno),
      hbl_number: str(j.expt_hblno),
      bl_date: ddmmyyyyToIso(j.expt_bldt) ?? undefined,
      sb_number: str(j.expt_shipbillno),
      leo_date: ddmmyyyyToIso(j.gate_in_dt) ?? undefined,
      gate_in_date: ddmmyyyyToIso(j.gate_in_dt) ?? undefined,
      gate_details: str(j.gate_in_place),
      invoice_number: str(j.expt_invno),
      gate_in_done: !!ddmmyyyyToIso(j.gate_in_dt) || undefined,
      bl_released: !!str(j.expt_blno) || undefined,
      archived: false, // back in window → always unhide
      // France import side (console dossier observations)
      console_no_erp: fr ? str(fr.consoleno) : undefined,
      rdv_date:
        anyToIso(fr?.j_conf_rdv) ?? anyToIso(fr?.j_req_rdv) ??
        anyToIso(fr?.conf_rdv) ?? anyToIso(fr?.req_rdv) ?? undefined,
      odt_date: anyToIso(fr?.j_odt) ?? anyToIso(fr?.odt) ?? undefined,
      odt_sent: fr ? !!(anyToIso(fr.j_odt) ?? anyToIso(fr.odt)) || undefined : undefined,
      douane_amr_ref: fr ? str(fr.douaneno) : undefined,
      douane_date:
        anyToIso(fr?.douanedt) ?? anyToIso(fr?.j_instr) ?? anyToIso(fr?.instr_douane) ?? undefined,
      shipping_line_inv: anyToIso(fr?.shpline_invdt) ?? undefined,
      arrival_notice_sent: fr ? !!anyToIso(fr.rel_sent) || undefined : undefined,
      arrival_notice_date: anyToIso(fr?.rel_sent) ?? anyToIso(fr?.rel_print) ?? undefined,
      cpu_scr: fr ? str(fr.pincode) : undefined,
      ata: ata ?? undefined,
      t1_no: fr ? str(fr.t1_no) : undefined,
      t1_date: anyToIso(fr?.t1_dt) ?? undefined,
      container_release_info:
        anyToIso(fr?.releasedt) ?? anyToIso(fr?.do_pin_trans) ?? undefined,
    };
    // drop undefined keys so we don't clobber dashboard-managed fields with null
    const cleanErpData = Object.fromEntries(
      Object.entries(erpData).filter(([, v]) => v !== undefined)
    );

    const statusName = inferStatusName(j, jobContainers, fr, ata);
    const inferredStatus = statusByName.get(statusName.toLowerCase());
    if (!inferredStatus) warnings.push(`status name not found: ${statusName}`);

    const existing = existingJobByExptno.get(j.exptno);
    if (existing) {
      // merge: ERP fields overwrite, dashboard-only fields survive
      const mergedData = { ...(existing.data as Record<string, unknown>), ...cleanErpData };
      const patch: Record<string, unknown> = {
        data: mergedData,
        container_id: containerId,
        updated_at: new Date().toISOString(),
      };
      // forward-only status: never move a job backwards (protects France-side manual stages)
      if (inferredStatus) {
        const currentOrder = existing.status_id
          ? statusOrderById.get(existing.status_id) ?? -1
          : -1;
        if (inferredStatus.display_order > currentOrder) {
          patch.status_id = inferredStatus.id;
        }
      }
      const { error } = await sb.from("airops_jobs").update(patch).eq("id", existing.id);
      if (error) warnings.push(`job ${j.exptno}: ${error.message}`);
      else jobsUpdated++;
    } else {
      const { error } = await sb.from("airops_jobs").insert({
        data: cleanErpData,
        status_id: inferredStatus?.id ?? null,
        container_id: containerId,
        column_order: 0,
        cross_verified: false,
      });
      if (error) warnings.push(`job ${j.exptno}: ${error.message}`);
      else jobsInserted++;
    }
  }

  // 7. archive ERP jobs that fell out of the sync window (sailed long ago).
  // Board hides archived jobs; they un-archive automatically if seen again.
  let jobsArchived = 0;
  const fetchedExptnos = new Set(jobs.map((j) => j.exptno));
  for (const [exptno, existing] of existingJobByExptno) {
    if (fetchedExptnos.has(exptno)) continue;
    const data = existing.data as Record<string, unknown>;
    if (data.archived === true) continue; // already archived
    const statusName = existing.status_id
      ? (statuses ?? []).find((s) => s.id === existing.status_id)?.name
      : null;
    if (statusName?.toLowerCase() === "completed") continue; // keep completed visible until wiped
    const { error } = await sb
      .from("airops_jobs")
      .update({ data: { ...data, archived: true }, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) warnings.push(`archive ${exptno}: ${error.message}`);
    else jobsArchived++;
  }

  return {
    wiped: !!opts.wipe,
    erpJobs: jobs.length,
    vesselsUpserted,
    containersUpserted,
    jobsInserted,
    jobsUpdated,
    jobsArchived,
    warnings,
  };
}
