"use client";

import { useState, useMemo } from "react";
import { useAiropsJobs, useAiropsStatuses, useAiropsVessels } from "@/lib/queries/airops";
import type { AiropsJob } from "@/lib/types/airops";

// ─── Column definitions ───────────────────────────────────────────────────────

const ALL_COLUMNS: { key: string; label: string; defaultOn: boolean; get: (j: AiropsJob) => string | number }[] = [
  { key: "order_no",            label: "Order No",          defaultOn: true,  get: (j) => j.data.order_no ?? "" },
  { key: "status",              label: "Status",            defaultOn: true,  get: (j) => j.status?.name ?? "" },
  { key: "consignee_name",      label: "Consignee",         defaultOn: true,  get: (j) => j.data.consignee_name ?? "" },
  { key: "shipper_name",        label: "Shipper",           defaultOn: true,  get: (j) => j.data.shipper_name ?? "" },
  { key: "job_type",            label: "Job Type",          defaultOn: true,  get: (j) => j.data.job_type ?? "" },
  { key: "vessel",              label: "Vessel",            defaultOn: true,  get: (j) => j.container?.vessel?.name ?? "" },
  { key: "etd",                 label: "ETD",               defaultOn: true,  get: (j) => j.data.etd ?? "" },
  { key: "eta",                 label: "ETA",               defaultOn: true,  get: (j) => j.data.eta ?? "" },
  { key: "booking_no",          label: "Booking No",        defaultOn: true,  get: (j) => j.data.booking_no ?? "" },
  { key: "console_no",          label: "Console No",        defaultOn: true,  get: (j) => j.console_no ?? "" },
  { key: "container_numbers",   label: "Container No",      defaultOn: true,  get: (j) => (j.data.container_numbers ?? []).join(", ") },
  { key: "pol",                 label: "POL",               defaultOn: true,  get: (j) => j.data.pol ?? "" },
  { key: "volume",              label: "Volume (CBM)",      defaultOn: false, get: (j) => j.data.volume ?? "" },
  { key: "gross_weight",        label: "Gross Weight",      defaultOn: false, get: (j) => j.data.gross_weight ?? "" },
  { key: "net_weight",          label: "Net Weight",        defaultOn: false, get: (j) => j.data.net_weight ?? "" },
  { key: "quantity_pcs",        label: "Qty (pcs)",         defaultOn: false, get: (j) => j.data.quantity_pcs ?? "" },
  { key: "no_of_cartons",       label: "No. of Cartons",    defaultOn: false, get: (j) => j.data.no_of_cartons ?? "" },
  { key: "pkgs_cases",          label: "Pkgs / Cases",      defaultOn: false, get: (j) => j.data.pkgs_cases ?? "" },
  { key: "cargo_handover_date", label: "Cargo Handover",    defaultOn: false, get: (j) => j.data.cargo_handover_date ?? "" },
  { key: "mbl_number",          label: "MBL No",            defaultOn: false, get: (j) => j.data.mbl_number ?? "" },
  { key: "hbl_number",          label: "HBL No",            defaultOn: false, get: (j) => j.data.hbl_number ?? "" },
  { key: "sb_number",           label: "SB No",             defaultOn: false, get: (j) => j.data.sb_number ?? "" },
  { key: "erp_exp_number",      label: "ERP Exp No",        defaultOn: false, get: (j) => j.data.erp_exp_number ?? "" },
  { key: "transporter",         label: "Transporter",       defaultOn: false, get: (j) => j.data.transporter ?? "" },
  { key: "leo_date",            label: "LEO Date",          defaultOn: false, get: (j) => j.data.leo_date ?? "" },
  { key: "gate_in_date",        label: "Gate In Date",      defaultOn: false, get: (j) => j.data.gate_in_date ?? "" },
  { key: "bl_date",             label: "BL Date",           defaultOn: false, get: (j) => j.data.bl_date ?? "" },
  { key: "invoice_number",      label: "Invoice No",        defaultOn: false, get: (j) => j.data.invoice_number ?? "" },
  { key: "rdv_date",            label: "RDV Date",          defaultOn: false, get: (j) => j.data.rdv_date ?? "" },
  { key: "ata",                 label: "ATA",               defaultOn: false, get: (j) => j.data.ata ?? "" },
  { key: "cpu_scr",             label: "CPU / SCR",         defaultOn: false, get: (j) => j.data.cpu_scr ?? "" },
  { key: "t1_no",               label: "T1 No",             defaultOn: false, get: (j) => j.data.t1_no ?? "" },
  { key: "t1_date",             label: "T1 Date",           defaultOn: false, get: (j) => j.data.t1_date ?? "" },
  { key: "odt_date",            label: "ODT Date",          defaultOn: false, get: (j) => j.data.odt_date ?? "" },
  { key: "arrival_notice_date", label: "Arrival Notice",    defaultOn: false, get: (j) => j.data.arrival_notice_date ?? "" },
  { key: "douane_amr_ref",      label: "Douane AMR Ref",    defaultOn: false, get: (j) => j.data.douane_amr_ref ?? "" },
  { key: "shipping_line_inv",   label: "Shipping Line Inv", defaultOn: false, get: (j) => j.data.shipping_line_inv ?? "" },
  { key: "cross_verified",      label: "Cross Verified",    defaultOn: false, get: (j) => j.cross_verified ? "Yes" : "No" },
  { key: "created_at",          label: "Created At",        defaultOn: false, get: (j) => j.created_at?.slice(0, 10) ?? "" },
];

const DEFAULT_ON = new Set(ALL_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));

export default function ExportPage() {
  const { data: jobs = [], isLoading } = useAiropsJobs();
  const { data: statuses = [] } = useAiropsStatuses();
  const { data: vessels = [] } = useAiropsVessels();

  // Column visibility
  const [enabledCols, setEnabledCols] = useState<Set<string>>(new Set(DEFAULT_ON));

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vesselFilter, setVesselFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Row selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filtered jobs
  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (search && !`${j.data.order_no ?? ""} ${j.data.consignee_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && j.status_id !== statusFilter) return false;
      if (vesselFilter && j.container?.vessel?.id !== vesselFilter) return false;
      if (dateFrom && j.created_at < dateFrom) return false;
      if (dateTo && j.created_at > dateTo + "T23:59:59Z") return false;
      return true;
    });
  }, [jobs, search, statusFilter, vesselFilter, dateFrom, dateTo]);

  // Select all when filtered list changes
  const allSelected = filtered.length > 0 && filtered.every((j) => selected.has(j.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((j) => j.id)));
  }
  function toggleRow(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  const visibleCols = ALL_COLUMNS.filter((c) => enabledCols.has(c.key));
  const exportRows = filtered.filter((j) => selected.has(j.id));

  async function handleExport() {
    const XLSX = await import("xlsx");
    const rows = exportRows.map((j) => {
      const row: Record<string, string | number> = {};
      for (const col of visibleCols) row[col.label] = col.get(j);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, `AirOps_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        border: active ? "none" : "1px solid var(--border)",
        background: active ? "#6366f1" : "var(--surface-2)",
        color: active ? "#fff" : "var(--text-2)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text)" }}>Export Jobs</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            {exportRows.length} of {filtered.length} rows selected
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exportRows.length === 0}
          style={{
            padding: "6px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: exportRows.length === 0 ? "var(--surface-2)" : "#6366f1",
            color: exportRows.length === 0 ? "var(--text-3)" : "#fff",
            border: "none",
            cursor: exportRows.length === 0 ? "default" : "pointer",
          }}
        >
          ↓ Download Excel
        </button>
      </div>

      {/* ── Column toggles ── */}
      <div
        className="px-6 py-3 shrink-0 flex flex-col gap-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold mr-1" style={{ color: "var(--text-3)" }}>COLUMNS</span>
          {pill(false, () => setEnabledCols(new Set(ALL_COLUMNS.map((c) => c.key))), "All")}
          {pill(false, () => setEnabledCols(new Set(DEFAULT_ON)), "Default")}
          {pill(false, () => setEnabledCols(new Set()), "None")}
          <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
          {ALL_COLUMNS.map((c) => pill(
            enabledCols.has(c.key),
            () => setEnabledCols((prev) => { const s = new Set(prev); s.has(c.key) ? s.delete(c.key) : s.add(c.key); return s; }),
            c.label,
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div
        className="px-6 py-3 shrink-0 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <input
          placeholder="Search order / consignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            height: 32, borderRadius: 8, padding: "0 10px", fontSize: 12,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text)", outline: "none", width: 200,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: 32, borderRadius: 8, padding: "0 8px", fontSize: 12,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text)", outline: "none",
          }}
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={vesselFilter}
          onChange={(e) => setVesselFilter(e.target.value)}
          style={{
            height: 32, borderRadius: 8, padding: "0 8px", fontSize: 12,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text)", outline: "none",
          }}
        >
          <option value="">All Vessels</option>
          {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ height: 32, borderRadius: 8, padding: "0 8px", fontSize: 12, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ height: 32, borderRadius: 8, padding: "0 8px", fontSize: 12, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
        </div>
        {(search || statusFilter || vesselFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setVesselFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40" style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
                <th style={{ width: 36, padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      padding: "8px 12px", borderBottom: "1px solid var(--border)",
                      textAlign: "left", whiteSpace: "nowrap",
                      color: "var(--text-2)", fontWeight: 600, fontSize: 11,
                      letterSpacing: "0.03em", textTransform: "uppercase",
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((j, i) => (
                <tr
                  key={j.id}
                  style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")}
                >
                  <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                    <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleRow(j.id)} />
                  </td>
                  {visibleCols.map((c) => {
                    const val = c.get(j);
                    if (c.key === "status") {
                      const hex = j.status?.color_hex ?? "a3a3a3";
                      const color = hex.startsWith("#") ? hex : `#${hex}`;
                      return (
                        <td key={c.key} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: color + "22", color, border: `1px solid ${color}55` }}>
                            {val}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", color: "var(--text)", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length + 1} style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    No jobs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
