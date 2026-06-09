"use client";

import { useState, useMemo } from "react";
import { useAiropsJobs, useAiropsStatuses, useAiropsVessels } from "@/lib/queries/airops";
import { useAiropsStore } from "@/lib/stores/airops-store";
import { AiropsDetailPanel } from "@/components/airops/AiropsDetailPanel";
import type { AiropsJob } from "@/lib/types/airops";

// ─── Column definitions ───────────────────────────────────────────────────────

type ColKey =
  | "order_no"
  | "status"
  | "consignee"
  | "shipper"
  | "job_type"
  | "vessel"
  | "etd"
  | "eta"
  | "container_no"
  | "volume"
  | "gross_wt"
  | "console_no"
  | "cross_verified"
  | "created_at";

interface ColDef {
  key: ColKey;
  label: string;
  width: number;
  sticky?: boolean;
  align?: "left" | "center" | "right";
}

const COLUMNS: ColDef[] = [
  { key: "order_no",       label: "Order No",       width: 130, sticky: true },
  { key: "status",         label: "Status",          width: 150 },
  { key: "consignee",      label: "Consignee",       width: 180 },
  { key: "shipper",        label: "Shipper",         width: 160 },
  { key: "job_type",       label: "Job Type",        width: 110 },
  { key: "vessel",         label: "Vessel",          width: 160 },
  { key: "etd",            label: "ETD",             width: 105 },
  { key: "eta",            label: "ETA",             width: 105 },
  { key: "container_no",   label: "Container No",    width: 145 },
  { key: "volume",         label: "Volume",          width: 90,  align: "right" },
  { key: "gross_wt",       label: "Gross Wt",        width: 100, align: "right" },
  { key: "console_no",     label: "Console No",      width: 120 },
  { key: "cross_verified", label: "Cross Verified",  width: 120, align: "center" },
  { key: "created_at",     label: "Created At",      width: 120 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

function getCellValue(job: AiropsJob, key: ColKey): string | number | boolean | null {
  const d = job.data ?? {};
  switch (key) {
    case "order_no":       return d.order_no ?? null;
    case "status":         return job.status?.name ?? null;
    case "consignee":      return d.consignee_name ?? null;
    case "shipper":        return d.shipper_name ?? null;
    case "job_type":       return d.job_type ?? null;
    case "vessel":         return d.vessel_name ?? job.container?.vessel?.name ?? null;
    case "etd":            return d.etd ?? job.container?.vessel?.etd ?? null;
    case "eta":            return d.eta ?? job.container?.vessel?.eta ?? null;
    case "container_no":   return (d.container_numbers ?? []).join(", ") || job.container?.container_number || null;
    case "volume":         return d.volume ?? null;
    case "gross_wt":       return d.gross_weight ?? null;
    case "console_no":     return job.console_no ?? null;
    case "cross_verified": return job.cross_verified ?? false;
    case "created_at":     return job.created_at;
    default:               return null;
  }
}

function sortJobs(jobs: AiropsJob[], key: ColKey, dir: "asc" | "desc"): AiropsJob[] {
  return [...jobs].sort((a, b) => {
    const av = getCellValue(a, key);
    const bv = getCellValue(b, key);
    const as = av == null ? "" : String(av);
    const bs = bv == null ? "" : String(bv);
    const cmp = as.localeCompare(bs, undefined, { numeric: true });
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
  if (dir === "desc") return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 9 12 5 16 9" />
      <polyline points="16 15 12 19 8 15" />
    </svg>
  );
}

// ─── Row number column width ──────────────────────────────────────────────────
const ROW_NUM_W = 40;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiroptsSheetsPage() {
  const openPanel = useAiropsStore((s) => s.openPanel);

  const [search,     setSearch]     = useState("");
  const [statusId,   setStatusId]   = useState<string>("");
  const [vesselId,   setVesselId]   = useState<string>("");
  const [sortKey,    setSortKey]    = useState<ColKey>("order_no");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");
  const [hovRow,     setHovRow]     = useState<number | null>(null);

  const { data: allJobs = [],    isLoading: loadingJobs    } = useAiropsJobs();
  const { data: statuses = [] }                               = useAiropsStatuses();
  const { data: vessels = [] }                                = useAiropsVessels();

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let jobs = allJobs;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      jobs = jobs.filter((j) => {
        const orderNo = (j.data?.order_no ?? "").toLowerCase();
        const consignee = (j.data?.consignee_name ?? "").toLowerCase();
        return orderNo.includes(q) || consignee.includes(q);
      });
    }

    if (statusId) {
      jobs = jobs.filter((j) => j.status_id === statusId);
    }

    if (vesselId) {
      jobs = jobs.filter((j) => j.container?.vessel_id === vesselId || j.container?.vessel?.id === vesselId);
    }

    return sortJobs(jobs, sortKey, sortDir);
  }, [allJobs, search, statusId, vesselId, sortKey, sortDir]);

  // ── Sort handler ──────────────────────────────────────────────────────────
  function handleSort(key: ColKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const totalColWidth = ROW_NUM_W + COLUMNS.reduce((acc, c) => acc + c.width, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        {/* Search */}
        <input
          type="search"
          placeholder="Search order no / consignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "var(--text)",
            fontSize: 13,
            width: 220,
            outline: "none",
          }}
        />

        {/* Status filter */}
        <select
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: statusId ? "var(--text)" : "var(--text-3)",
            fontSize: 13,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Vessel filter */}
        <select
          value={vesselId}
          onChange={(e) => setVesselId(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: vesselId ? "var(--text)" : "var(--text-3)",
            fontSize: 13,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All vessels</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        {/* Spacer + count */}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
          {loadingJobs ? "Loading…" : `${filtered.length} job${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Table area ──────────────────────────────────────────────────────── */}
      {loadingJobs ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {[0, 150, 300].map((d) => (
            <div key={d} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--border-2)",
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${d}ms`,
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-3)" }}>
          No jobs to display.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: totalColWidth,
          }}>
            <colgroup>
              <col style={{ width: ROW_NUM_W }} />
              {COLUMNS.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <thead>
              <tr style={{ height: 34 }}>
                {/* row number spacer */}
                <th style={{
                  position: "sticky", top: 0, left: 0, zIndex: 40,
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                  width: ROW_NUM_W,
                }} />

                {COLUMNS.map((col) => {
                  const isSorted = sortKey === col.key;

                  return (
                    <th
                      key={col.key}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: col.sticky ? ROW_NUM_W : undefined,
                        zIndex: col.sticky ? 30 : 20,
                        background: "var(--surface-2)",
                        borderBottom: "1px solid var(--border)",
                        borderRight: "1px solid var(--border)",
                        padding: "0 10px",
                        textAlign: col.align ?? "left",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                      }}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          width: "100%",
                          justifyContent: col.align === "center" ? "center" : col.align === "right" ? "flex-end" : "flex-start",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-2)",
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: 0,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{col.label}</span>
                        <span style={{
                          flexShrink: 0,
                          color: isSorted ? "#6366f1" : "var(--text-3)",
                          opacity: isSorted ? 1 : 0.5,
                          display: "flex",
                          alignItems: "center",
                        }}>
                          <SortIcon dir={isSorted ? sortDir : null} />
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <tbody>
              {filtered.map((job, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                const isHov  = hovRow === rowIdx;
                const rowBg  = isHov
                  ? "var(--surface-hover)"
                  : isEven
                    ? "var(--surface)"
                    : "var(--surface-2)";

                return (
                  <tr
                    key={job.id}
                    onClick={() => openPanel(job.id)}
                    onMouseEnter={() => setHovRow(rowIdx)}
                    onMouseLeave={() => setHovRow(null)}
                    style={{
                      height: 34,
                      cursor: "pointer",
                      background: rowBg,
                      borderBottom: "1px solid var(--border)",
                      transition: "background 100ms",
                    }}
                  >
                    {/* Row number */}
                    <td style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 10,
                      background: rowBg,
                      borderRight: "1px solid var(--border)",
                      textAlign: "center",
                      fontSize: 10,
                      color: "var(--text-3)",
                      userSelect: "none",
                      fontVariantNumeric: "tabular-nums",
                      transition: "background 100ms",
                    }}>
                      {rowIdx + 1}
                    </td>

                    {COLUMNS.map((col) => {
                      const raw = getCellValue(job, col.key);

                      let content: React.ReactNode;

                      if (col.key === "status") {
                        const s = job.status;
                        content = s ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                              background: s.color_hex.startsWith("#") ? s.color_hex : `#${s.color_hex}`,
                            }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                          </span>
                        ) : <span style={{ color: "var(--text-3)" }}>—</span>;

                      } else if (col.key === "cross_verified") {
                        content = (
                          <span style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: job.cross_verified ? "#10b981" : "var(--text-3)",
                          }}>
                            {job.cross_verified ? "✓" : "—"}
                          </span>
                        );

                      } else if (col.key === "etd" || col.key === "eta" || col.key === "created_at") {
                        content = raw ? fmtDate(String(raw)) : <span style={{ color: "var(--text-3)" }}>—</span>;

                      } else {
                        content = raw != null && raw !== ""
                          ? String(raw)
                          : <span style={{ color: "var(--text-3)" }}>—</span>;
                      }

                      return (
                        <td
                          key={col.key}
                          style={{
                            position: col.sticky ? "sticky" : undefined,
                            left: col.sticky ? ROW_NUM_W : undefined,
                            zIndex: col.sticky ? 10 : undefined,
                            background: col.sticky ? rowBg : undefined,
                            borderRight: "1px solid var(--border)",
                            padding: "0 10px",
                            fontSize: 12,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textAlign: col.align ?? "left",
                            transition: "background 100ms",
                          }}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail panel ────────────────────────────────────────────────────── */}
      <AiropsDetailPanel />
    </div>
  );
}
