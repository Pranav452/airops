"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAiropsStatuses,
  useAiropsJobs,
  useAiropsVessels,
  useUpdateJob,
} from "@/lib/queries/airops";
import { useAiropsStore } from "@/lib/stores/airops-store";
import { AiropsColumn } from "@/components/airops/AiropsColumn";
import { AiropsDetailPanel } from "@/components/airops/AiropsDetailPanel";
import { ConsigneeApprovalBell } from "@/components/airops/ConsigneeApprovalBell";
import { createClient } from "@/lib/supabase/client";
import type { AiropsFilters, AiropsJob, AiropsStatus } from "@/lib/types/airops";
import {
  useAllRequiredFields,
  useAutoProgressionRules,
  writeAuditLog,
} from "@/lib/queries/airops-admin";
import type { AiropsColumnRequiredField, AiropsAutoProgression } from "@/lib/types/airops-admin";

type ViewMode = "board" | "sheets";
type SortDir = "asc" | "desc" | null;
type TeamView = "all" | "pol" | "france";

// ─── Bajaj-style Sheets spreadsheet ──────────────────────────────────────────

interface SheetColDef {
  key: string; label: string; defaultWidth: number;
  type?: "text" | "number" | "date" | "boolean" | "status" | "readonly";
  sticky?: boolean; dataKey?: string; jobKey?: string;
}

const SHEET_COLS: SheetColDef[] = [
  { key: "order_no",            label: "Order No",       defaultWidth: 130, sticky: true, type: "readonly", dataKey: "order_no" },
  { key: "status",              label: "Status",         defaultWidth: 160, type: "status" },
  { key: "consignee_name",      label: "Consignee",      defaultWidth: 160, dataKey: "consignee_name" },
  { key: "shipper_name",        label: "Shipper",        defaultWidth: 150, dataKey: "shipper_name" },
  { key: "job_type",            label: "Job Type",       defaultWidth: 110, dataKey: "job_type" },
  { key: "vessel",              label: "Vessel",         defaultWidth: 150, type: "readonly" },
  { key: "etd",                 label: "ETD",            defaultWidth: 110, type: "date", dataKey: "etd" },
  { key: "eta",                 label: "ETA",            defaultWidth: 110, type: "date", dataKey: "eta" },
  { key: "booking_no",          label: "Booking No",     defaultWidth: 130, dataKey: "booking_no" },
  { key: "container_numbers",   label: "Container No",   defaultWidth: 160, type: "readonly" },
  { key: "mbl_number",          label: "MBL No",         defaultWidth: 130, dataKey: "mbl_number" },
  { key: "hbl_number",          label: "HBL No",         defaultWidth: 130, dataKey: "hbl_number" },
  { key: "sb_number",           label: "SB No",          defaultWidth: 110, dataKey: "sb_number" },
  { key: "console_no",          label: "Console No",     defaultWidth: 120, type: "readonly", jobKey: "console_no" },
  { key: "pol",                 label: "POL",            defaultWidth: 100, dataKey: "pol" },
  { key: "volume",              label: "Vol (CBM)",      defaultWidth: 90,  type: "number", dataKey: "volume" },
  { key: "gross_weight",        label: "Gross Wt",       defaultWidth: 90,  type: "number", dataKey: "gross_weight" },
  { key: "net_weight",          label: "Net Wt",         defaultWidth: 90,  type: "number", dataKey: "net_weight" },
  { key: "quantity_pcs",        label: "Qty (pcs)",      defaultWidth: 80,  type: "number", dataKey: "quantity_pcs" },
  { key: "no_of_cartons",       label: "Cartons",        defaultWidth: 80,  type: "number", dataKey: "no_of_cartons" },
  { key: "pkgs_cases",          label: "Pkgs/Cases",     defaultWidth: 100, dataKey: "pkgs_cases" },
  { key: "cargo_handover_date", label: "Cargo Handover", defaultWidth: 130, type: "date",   dataKey: "cargo_handover_date" },
  { key: "transporter",         label: "Transporter",    defaultWidth: 130, dataKey: "transporter" },
  { key: "leo_date",            label: "LEO Date",       defaultWidth: 110, type: "date",   dataKey: "leo_date" },
  { key: "gate_in_date",        label: "Gate In",        defaultWidth: 110, type: "date",   dataKey: "gate_in_date" },
  { key: "bl_date",             label: "BL Date",        defaultWidth: 110, type: "date",   dataKey: "bl_date" },
  { key: "invoice_number",      label: "Invoice No",     defaultWidth: 120, dataKey: "invoice_number" },
  { key: "rdv_date",            label: "RDV Date",       defaultWidth: 110, type: "date",   dataKey: "rdv_date" },
  { key: "ata",                 label: "ATA",            defaultWidth: 110, type: "date",   dataKey: "ata" },
  { key: "cpu_scr",             label: "CPU/SCR",        defaultWidth: 110, dataKey: "cpu_scr" },
  { key: "t1_no",               label: "T1 No",          defaultWidth: 100, dataKey: "t1_no" },
  { key: "t1_date",             label: "T1 Date",        defaultWidth: 110, type: "date",   dataKey: "t1_date" },
  { key: "cross_verified",      label: "Verified",       defaultWidth: 70,  type: "boolean", jobKey: "cross_verified" },
  { key: "created_at",          label: "Created",        defaultWidth: 110, type: "readonly" },
];

const ROW_NUM_W = 40;
const EMPTY = <span style={{ color: "var(--text-3)" }}>—</span>;

function ResizeHandle({ onResize }: { onResize: (dx: number) => void }) {
  const startX = useRef<number>(0);
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX;
    const onMove = (me: MouseEvent) => { onResize(me.clientX - startX.current); startX.current = me.clientX; };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  return (
    <div onMouseDown={onMouseDown} style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 6, cursor: "col-resize", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1, height: 14, background: "var(--border)" }} />
    </div>
  );
}

function SheetCell({ col, job, isFocused, onFocus, onSave, onNavigate }: {
  col: SheetColDef; job: AiropsJob; isFocused: boolean;
  onFocus: () => void;
  onSave: (key: string, val: string | number | boolean) => void;
  onNavigate: (dir: "up" | "down" | "tab") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  let raw: unknown = null;
  if (col.jobKey) raw = (job as unknown as Record<string, unknown>)[col.jobKey!];
  else if (col.dataKey) raw = (job.data as Record<string, unknown>)[col.dataKey];
  else if (col.key === "vessel") raw = job.container?.vessel?.name ?? null;
  else if (col.key === "container_numbers") raw = (job.data.container_numbers ?? []).join(", ") || null;
  else if (col.key === "created_at") raw = job.created_at?.slice(0, 10) ?? null;

  const display = raw != null && raw !== "" ? String(raw) : null;
  const base: React.CSSProperties = { width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 10px", fontSize: 12 };

  if (col.type === "boolean") {
    const on = raw === true || raw === 1 || raw === "true";
    return (
      <div style={{ ...base, justifyContent: "center", cursor: "pointer" }}
        onClick={() => { onFocus(); onSave(col.jobKey ?? col.dataKey ?? col.key, !on); }}>
        <span style={{ fontWeight: 700, color: on ? "#16a34a" : "var(--text-3)" }}>{on ? "✓" : "—"}</span>
      </div>
    );
  }
  if (col.type === "readonly") {
    return <div style={{ ...base, color: display ? "var(--text)" : undefined }}>{display ?? EMPTY}</div>;
  }

  function commit() {
    setEditing(false);
    if (draft !== (display ?? "")) {
      const key = col.dataKey ?? col.key;
      onSave(key, col.type === "number" && draft !== "" ? Number(draft) : draft);
    }
  }

  if (editing) {
    return (
      <input ref={inputRef} value={draft}
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        style={{ width: "100%", height: "100%", padding: "0 10px", fontSize: 12, border: "none", outline: "none", background: "#fefce8", color: "var(--text)" }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); onNavigate("down"); }
          if (e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate(e.shiftKey ? "up" : "tab"); }
          if (e.key === "ArrowUp") { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate("up"); }
          if (e.key === "ArrowDown") { e.preventDefault(); (e.target as HTMLInputElement).blur(); onNavigate("down"); }
        }}
      />
    );
  }
  return (
    <div style={{ ...base, cursor: "text", color: display ? "var(--text)" : undefined, userSelect: "none" }}
      onClick={() => { onFocus(); setDraft(display ?? ""); setEditing(true); }}>
      {display ?? EMPTY}
    </div>
  );
}

function SheetsView({ jobs, onSelectJob, selectedId, onSaveCell }: {
  jobs: AiropsJob[];
  onSelectJob: (id: string) => void;
  selectedId: string | null;
  onSaveCell: (jobId: string, key: string, val: string | number | boolean) => void;
}) {
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [focusCell, setFocusCell] = useState<[number, number] | null>(null);
  const [hovRow, setHovRow] = useState<number | null>(null);
  const [widths, setWidths] = useState<number[]>(() => SHEET_COLS.map((c) => c.defaultWidth));

  const sorted = useMemo(() => {
    if (!sortDir) return jobs;
    return [...jobs].sort((a, b) => {
      const col = SHEET_COLS.find((c) => c.key === sortKey);
      if (!col) return 0;
      let av: unknown = null, bv: unknown = null;
      if (col.jobKey) { av = (a as unknown as Record<string, unknown>)[col.jobKey!]; bv = (b as unknown as Record<string, unknown>)[col.jobKey!]; }
      else if (col.dataKey) { av = (a.data as Record<string, unknown>)[col.dataKey]; bv = (b.data as Record<string, unknown>)[col.dataKey]; }
      else if (col.key === "vessel") { av = a.container?.vessel?.name; bv = b.container?.vessel?.name; }
      else if (col.key === "created_at") { av = a.created_at; bv = b.created_at; }
      return (sortDir === "asc" ? 1 : -1) * String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
    });
  }, [jobs, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : d === "desc" ? null : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function resizeCol(i: number, dx: number) {
    setWidths((prev) => { const n = [...prev]; n[i] = Math.max(50, n[i] + dx); return n; });
  }

  function handleNavigate(ri: number, ci: number, dir: "up" | "down" | "tab") {
    let nr = ri;
    if (dir === "down" || dir === "tab") nr = Math.min(sorted.length - 1, ri + 1);
    else if (dir === "up") nr = Math.max(0, ri - 1);
    setFocusCell([nr, ci]);
  }

  const stickyLeft = ROW_NUM_W;
  const totalW = ROW_NUM_W + widths.reduce((a, b) => a + b, 0);

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--background)" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: totalW }}>
        <colgroup>
          <col style={{ width: ROW_NUM_W }} />
          {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead>
          <tr style={{ height: 34, background: "var(--surface)", position: "sticky", top: 0, zIndex: 20 }}>
            <th style={{ width: ROW_NUM_W, position: "sticky", left: 0, zIndex: 30, background: "var(--surface)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }} />
            {SHEET_COLS.map((col, ci) => {
              const active = sortKey === col.key && !!sortDir;
              return (
                <th key={col.key} style={{ position: "sticky", top: 0, left: col.sticky ? stickyLeft : undefined, zIndex: col.sticky ? 30 : 20, background: "var(--surface)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", padding: "0 10px", textAlign: "left", whiteSpace: "nowrap", userSelect: "none" }}>
                  <button onClick={() => handleSort(col.key)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: active ? "#6366f1" : "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <span>{col.label}</span>
                    <span style={{ opacity: active ? 1 : 0.3, fontSize: 10 }}>{active && sortDir === "asc" ? "↑" : active && sortDir === "desc" ? "↓" : "↕"}</span>
                  </button>
                  <ResizeHandle onResize={(dx) => resizeCol(ci, dx)} />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job, ri) => {
            const isEven = ri % 2 === 0;
            const isSelected = job.id === selectedId;
            const isHov = hovRow === ri;
            const rowBg = isSelected ? "#eef2ff" : isHov ? "#f5f3ff" : isEven ? "var(--surface)" : "var(--surface-2)";
            return (
              <tr key={job.id} style={{ height: 32, borderBottom: "1px solid var(--border)" }}
                onMouseEnter={() => setHovRow(ri)} onMouseLeave={() => setHovRow(null)}>
                <td onClick={() => onSelectJob(job.id)} style={{ position: "sticky", left: 0, zIndex: 10, background: rowBg, borderRight: "1px solid var(--border)", textAlign: "center", fontSize: 10, color: "var(--text-3)", userSelect: "none", cursor: "pointer", borderLeft: isSelected ? "3px solid #6366f1" : "3px solid transparent" }}>
                  {ri + 1}
                </td>
                {SHEET_COLS.map((col, ci) => {
                  const isFocused = focusCell?.[0] === ri && focusCell?.[1] === ci;
                  return (
                    <td key={col.key}
                      onClick={() => { setFocusCell([ri, ci]); if (col.type === "status" || col.type === "readonly") onSelectJob(job.id); }}
                      style={{ position: col.sticky ? "sticky" : undefined, left: col.sticky ? stickyLeft : undefined, zIndex: col.sticky ? 10 : undefined, background: rowBg, borderRight: "1px solid var(--border)", padding: 0, overflow: "hidden", maxWidth: widths[ci], outline: isFocused ? "2px solid #6366f1" : undefined, outlineOffset: isFocused ? "-2px" : undefined }}>
                      {col.type === "status" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", height: "100%" }}>
                          {job.status
                            ? <><span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: job.status.color_hex.startsWith("#") ? job.status.color_hex : `#${job.status.color_hex}` }} /><span style={{ fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.status.name}</span></>
                            : EMPTY}
                        </div>
                      ) : (
                        <SheetCell col={col} job={job} isFocused={isFocused} onFocus={() => setFocusCell([ri, ci])} onSave={(key, val) => onSaveCell(job.id, key, val)} onNavigate={(dir) => handleNavigate(ri, ci, dir)} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={SHEET_COLS.length + 1} style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No jobs found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Card field config ────────────────────────────────────────────────────────

const ALL_CARD_FIELDS: { key: string; label: string }[] = [
  { key: "order_no",           label: "Order No" },
  { key: "consignee_name",     label: "Consignee" },
  { key: "shipper_name",       label: "Shipper" },
  { key: "job_type",           label: "Job Type" },
  { key: "vessel_name",        label: "Vessel" },
  { key: "etd",                label: "ETD" },
  { key: "eta",                label: "ETA" },
  { key: "booking_no",         label: "Booking No" },
  { key: "container_numbers",  label: "Containers" },
  { key: "volume",             label: "Volume" },
  { key: "gross_weight",       label: "Gross Wt" },
  { key: "mbl_number",         label: "MBL No" },
  { key: "pol",                label: "POL" },
  { key: "console_no",         label: "Console No" },
];

const DEFAULT_CARD_FIELDS = ["order_no", "consignee_name", "etd", "vessel_name", "volume"];

// ─── Team config ─────────────────────────────────────────────────────────────

const TEAM_LABELS: Record<TeamView, string> = { all: "All columns", pol: "POL Team", france: "France Team" };
const TEAM_COLORS: Record<TeamView, { bg: string; color: string; border: string }> = {
  all:    { bg: "#f8fafc", color: "var(--text-2)", border: "var(--border)" },
  pol:    { bg: "#eef2ff", color: "#4f46e5",       border: "#c7d2fe" },
  france: { bg: "#fdf4ff", color: "#9333ea",       border: "#e9d5ff" },
};

// ─── Admin enforcement helpers ────────────────────────────────────────────────

/** Returns false when v is null/undefined or the string is "", "null", or "0". */
function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim();
  return s !== "" && s !== "null" && s !== "0";
}

/**
 * Given a job, the full list of required-field records and all statuses,
 * return any field keys that are missing for the target status.
 * Returns [] when no rules configured (allow move).
 */
function getMissingFields(
  job: AiropsJob,
  targetStatusId: string,
  requiredFields: AiropsColumnRequiredField[]
): string[] {
  const rules = requiredFields.filter((r) => r.status_id === targetStatusId);
  if (rules.length === 0) return [];
  return rules
    .filter((r) => !present((job.data as Record<string, unknown>)[r.field_key]))
    .map((r) => r.field_key);
}

/**
 * Given the updated job data and auto-progression rules, find the target
 * status with the highest display_order that:
 *  - has its trigger_field now present in jobData
 *  - is strictly AHEAD (higher display_order) of the job's current status
 * Returns null when no rule applies.
 */
function findAutoProgressionTarget(
  job: AiropsJob,
  jobData: Record<string, unknown>,
  rules: AiropsAutoProgression[],
  statuses: AiropsStatus[]
): AiropsStatus | null {
  if (rules.length === 0) return null;

  const currentStatus = statuses.find((s) => s.id === job.status_id);
  const currentOrder = currentStatus?.display_order ?? -1;

  // Collect candidate targets: rule fires when trigger_field is present
  const candidates: AiropsStatus[] = [];
  for (const rule of rules) {
    if (!present(jobData[rule.trigger_field])) continue;
    const target = statuses.find((s) => s.id === rule.target_status_id);
    if (!target) continue;
    // Only allow forward progression
    if (target.display_order <= currentOrder) continue;
    candidates.push(target);
  }

  if (candidates.length === 0) return null;
  // Choose the one with the highest display_order among candidates
  return candidates.reduce((best, s) =>
    s.display_order > best.display_order ? s : best
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function AiropsBoard() {
  const queryClient = useQueryClient();
  const [vesselFilter, setVesselFilter] = useState<string | null>(null);
  const [podFilter, setPodFilter] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<TeamView>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [cardFields, setCardFields] = useState<string[]>(DEFAULT_CARD_FIELDS);
  const [userTeam, setUserTeam] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [actorEmail, setActorEmail] = useState<string>("");
  const [syncState, setSyncState] = useState<"idle" | "running" | "done" | "error">("idle");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email) setActorEmail(data.user.email);
      const t = data.user?.user_metadata?.team;
      if (t === "pol" || t === "france") {
        setTeamView(t);
        setUserTeam(t);
      } else if (t) {
        setUserTeam(t);
      }
    });
  }, []);

  const { selectedJobId, isPanelOpen, openPanel, globalSearch: search, setGlobalSearch: setSearch } = useAiropsStore();
  const filters: AiropsFilters = { search: search || undefined, vessel_id: vesselFilter ?? undefined };
  const { data: statuses = [], isLoading: statusLoading } = useAiropsStatuses();
  const { data: jobs = [], isLoading: jobsLoading } = useAiropsJobs(filters);
  const { data: vessels = [] } = useAiropsVessels();
  const updateJob = useUpdateJob();

  // ── Admin enforcement ──────────────────────────────────────────────────────
  const { data: requiredFields = [] } = useAllRequiredFields();
  const { data: autoRules = [] } = useAutoProgressionRules();

  const uniquePods = useMemo(() => {
    const pods = vessels.map((v) => v.pod).filter((p): p is string => !!p);
    return Array.from(new Set(pods)).sort();
  }, [vessels]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (podFilter && j.container?.vessel?.pod !== podFilter) return false;
      if (dateFrom) {
        const etd = j.data.etd ?? j.data.current_etd;
        if (!etd || etd < dateFrom) return false;
      }
      if (dateTo) {
        const etd = j.data.etd ?? j.data.current_etd;
        if (!etd || etd > dateTo) return false;
      }
      return true;
    });
  }, [jobs, podFilter, dateFrom, dateTo]);

  const visibleStatuses = teamView === "pol"
    ? statuses.filter((s) => s.display_order <= 15)
    : teamView === "france"
    ? statuses.filter((s) => s.display_order > 15)
    : statuses;

  // ── Required-field gate + audit-logged drop ──────────────────────────────
  const handleDrop = useCallback(
    (jobId: string, newStatusId: string, newOrder: number) => {
      const job = jobs.find((j) => j.id === jobId);
      // If same column, just reorder — no gate needed
      if (!job || job.status_id === newStatusId) {
        updateJob.mutate({ id: jobId, updates: { status_id: newStatusId, column_order: newOrder } });
        return;
      }

      // Required-field gate (soft — user can override)
      if (requiredFields.length > 0) {
        const missing = getMissingFields(job, newStatusId, requiredFields);
        if (missing.length > 0) {
          const targetName = statuses.find((s) => s.id === newStatusId)?.name ?? newStatusId;
          const confirmed = window.confirm(
            `Moving to "${targetName}" but the following required fields are missing:\n\n• ${missing.join("\n• ")}\n\nMove anyway?`
          );
          if (!confirmed) return;
        }
      }

      updateJob.mutate(
        { id: jobId, updates: { status_id: newStatusId, column_order: newOrder } },
        {
          onSuccess: () => {
            if (actorEmail) {
              const fromName = statuses.find((s) => s.id === job.status_id)?.name ?? job.status_id ?? "unknown";
              const toName = statuses.find((s) => s.id === newStatusId)?.name ?? newStatusId;
              writeAuditLog({
                actor_email: actorEmail,
                action: "job_moved",
                target_type: "job",
                target_id: jobId,
                detail: { from_status: fromName, to_status: toName, order_no: job.data.order_no },
              });
            }
          },
        }
      );
    },
    [jobs, statuses, requiredFields, updateJob, actorEmail]
  );

  // ── Save cell with auto-progression check ────────────────────────────────
  const handleSaveCell = useCallback(
    (jobId: string, key: string, val: string | number | boolean) => {
      const job = jobs.find((j) => j.id === jobId);
      updateJob.mutate(
        { id: jobId, updates: { data: { [key]: val } } },
        {
          onSuccess: (updatedRaw) => {
            // Auto-progression: evaluate rules on updated data
            if (autoRules.length === 0) return;
            const updated = updatedRaw as AiropsJob | undefined;
            const jobData = updated
              ? (updated.data as Record<string, unknown>)
              : { ...(job?.data ?? {}), [key]: val };
            const baseJob = updated ?? job;
            if (!baseJob) return;

            const target = findAutoProgressionTarget(baseJob, jobData, autoRules, statuses);
            if (!target) return;

            // Move to target (no gate — auto progression bypasses required-field gate)
            updateJob.mutate(
              { id: jobId, updates: { status_id: target.id } },
              {
                onSuccess: () => {
                  if (actorEmail) {
                    writeAuditLog({
                      actor_email: actorEmail,
                      action: "auto_progression",
                      target_type: "job",
                      target_id: jobId,
                      detail: { trigger_field: key, to_status: target.name, order_no: job?.data.order_no },
                    });
                  }
                },
              }
            );
          },
        }
      );
    },
    [jobs, statuses, autoRules, updateJob, actorEmail]
  );

  async function handleErpSync() {
    if (syncState === "running") return;
    setSyncState("running");
    try {
      const res = await fetch("/api/erp/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "sync failed");
      setSyncState("done");
      queryClient.invalidateQueries();
      setTimeout(() => setSyncState("idle"), 4000);
    } catch (err) {
      console.error("ERP sync failed:", err);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 6000);
    }
  }

  const isLoading = statusLoading || jobsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>

        {/* Title + view toggle */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#6366f1" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" /><rect x="14" y="17" width="7" height="4" rx="1" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>AirOps</span>
          <div className="flex items-center rounded-lg p-0.5 ml-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {(["board", "sheets"] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className="flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-medium transition-all"
                style={{ background: viewMode === m ? "var(--surface)" : "transparent", color: viewMode === m ? "#6366f1" : "var(--text-3)", boxShadow: viewMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {m === "board"
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" /></svg>
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Filter button */}
        {(() => {
          const activeCount = (vesselFilter ? 1 : 0) + (podFilter ? 1 : 0) + (teamView !== "all" ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);
          return (
            <button
              onClick={() => { setShowFilterPanel((o) => !o); setShowViewPanel(false); }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium shrink-0"
              style={{
                background: showFilterPanel || activeCount > 0 ? "#eef2ff" : "var(--surface-2)",
                color: showFilterPanel || activeCount > 0 ? "#4f46e5" : "var(--text-2)",
                border: "1px solid var(--border)",
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54Z" /></svg>
              Filters
              {activeCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold text-white" style={{ background: "#4f46e5", lineHeight: 1 }}>
                  {activeCount}
                </span>
              )}
            </button>
          );
        })()}

        {/* View button */}
        <button
          onClick={() => { setShowViewPanel((o) => !o); setShowFilterPanel(false); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium shrink-0"
          style={{
            background: showViewPanel ? "#eef2ff" : "var(--surface-2)",
            color: showViewPanel ? "#4f46e5" : "var(--text-2)",
            border: "1px solid var(--border)",
          }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          View
        </button>

        <div className="flex-1" />
        <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}</span>

        {/* ERP Sync */}
        <button
          onClick={handleErpSync}
          disabled={syncState === "running"}
          title="Pull latest jobs, vessels and containers from the ERP database"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium shrink-0 transition-colors"
          style={{
            background: syncState === "error" ? "#fef2f2" : syncState === "done" ? "#ecfdf5" : "var(--surface-2)",
            border: "1px solid var(--border)",
            color: syncState === "error" ? "#dc2626" : syncState === "done" ? "#059669" : "#6366f1",
            opacity: syncState === "running" ? 0.7 : 1,
          }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={syncState === "running" ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
          </svg>
          {syncState === "running" ? "Syncing…" : syncState === "done" ? "Synced" : syncState === "error" ? "Sync failed" : "ERP Sync"}
        </button>

        {/* Refresh */}
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#6366f1")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
        </button>

        <ConsigneeApprovalBell team={userTeam || "pol"} />

        <Link href="/airops/canvas" className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="6" cy="8" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="12" cy="17" r="2" /><path d="M8 8h8M7 10l4 6M17 10l-4 6" /></svg>
          Canvas
        </Link>
        <Link href="/booking" className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white" style={{ background: "#6366f1" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Job
        </Link>
      </div>

      {/* ── Filter panel (Bajaj-style inline bar) ─────────────────────────────── */}
      {showFilterPanel && (
        <div className="px-5 py-3 shrink-0 flex items-start gap-6 flex-wrap" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          {/* Vessel */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>Vessel</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setVesselFilter(null)} className="px-2.5 h-6 rounded-md text-xs font-medium transition-colors"
                style={{ background: !vesselFilter ? "#6366f1" : "var(--surface)", color: !vesselFilter ? "white" : "var(--text-2)", border: "1px solid var(--border)" }}>All</button>
              {vessels.map((v) => (
                <button key={v.id} onClick={() => setVesselFilter(v.id === vesselFilter ? null : v.id)} className="px-2.5 h-6 rounded-md text-xs font-medium transition-colors"
                  style={{ background: vesselFilter === v.id ? "#6366f1" : "var(--surface)", color: vesselFilter === v.id ? "white" : "var(--text-2)", border: "1px solid var(--border)" }}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {/* POD */}
          {uniquePods.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>POD</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setPodFilter(null)} className="px-2.5 h-6 rounded-md text-xs font-medium transition-colors"
                  style={{ background: !podFilter ? "#6366f1" : "var(--surface)", color: !podFilter ? "white" : "var(--text-2)", border: "1px solid var(--border)" }}>All</button>
                {uniquePods.map((p) => (
                  <button key={p} onClick={() => setPodFilter(p === podFilter ? null : p)} className="px-2.5 h-6 rounded-md text-xs font-medium transition-colors"
                    style={{ background: podFilter === p ? "#6366f1" : "var(--surface)", color: podFilter === p ? "white" : "var(--text-2)", border: "1px solid var(--border)" }}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Team */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>Team</p>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "pol", "france"] as TeamView[]).map((t) => {
                const active = teamView === t;
                const tc = TEAM_COLORS[t];
                return (
                  <button key={t} onClick={() => setTeamView(t)} className="px-2.5 h-6 rounded-md text-xs font-medium transition-colors"
                    style={{ background: active ? tc.bg : "var(--surface)", color: active ? tc.color : "var(--text-3)", border: `1px solid ${active ? tc.border : "var(--border)"}` }}>
                    {TEAM_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>ETD Range</p>
            <div className="flex items-center gap-1.5 mb-2">
              {([
                { label: "This month", from: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0)] as const; } },
                { label: "Sailed", from: () => [null, new Date()] as const },
                { label: "Upcoming", from: () => [new Date(), null] as const },
              ]).map((p) => {
                const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
                const [f, t] = p.from();
                const active = dateFrom === fmt(f) && dateTo === fmt(t);
                return (
                  <button key={p.label}
                    onClick={() => { setDateFrom(active ? "" : fmt(f)); setDateTo(active ? "" : fmt(t)); }}
                    className="h-6 px-2.5 rounded-full text-[11px] font-medium"
                    style={{
                      background: active ? "#eef2ff" : "var(--surface)",
                      color: active ? "#4f46e5" : "var(--text-3)",
                      border: `1px solid ${active ? "#c7d2fe" : "var(--border)"}`,
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-6 rounded-md px-2 text-xs"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              <span className="text-xs" style={{ color: "var(--text-3)" }}>→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-6 rounded-md px-2 text-xs"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs" style={{ color: "#6366f1" }}>Clear</button>
              )}
            </div>
          </div>

          {/* Clear all + close */}
          <div className="flex flex-col justify-between items-end ml-auto">
            <button onClick={() => setShowFilterPanel(false)} style={{ color: "var(--text-3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m4 4 16 16M20 4 4 20" /></svg>
            </button>
            {(vesselFilter || podFilter || teamView !== "all" || dateFrom || dateTo) && (
              <button onClick={() => { setVesselFilter(null); setPodFilter(null); setTeamView("all"); setDateFrom(""); setDateTo(""); }}
                className="text-xs font-medium mt-auto" style={{ color: "#4f46e5" }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── View panel (Bajaj-style inline bar) ──────────────────────────────── */}
      {showViewPanel && (
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                  Card fields <span className="normal-case font-normal" style={{ color: "var(--text-3)" }}>(up to 5)</span>
                </p>
                <button onClick={() => setCardFields(DEFAULT_CARD_FIELDS)} className="text-[11px]" style={{ color: "#4f46e5" }}>Reset</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CARD_FIELDS.map((f) => {
                  const selected = cardFields.includes(f.key);
                  const disabled = !selected && cardFields.length >= 5;
                  return (
                    <button key={f.key}
                      onClick={() => {
                        if (selected) setCardFields((p) => p.filter((k) => k !== f.key));
                        else if (!disabled) setCardFields((p) => [...p, f.key]);
                      }}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors"
                      style={{
                        background: selected ? "#eef2ff" : "var(--surface)",
                        color: selected ? "#4f46e5" : "var(--text-2)",
                        borderColor: selected ? "#c7d2fe" : "var(--border)",
                        opacity: disabled ? 0.4 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setShowViewPanel(false)} style={{ color: "var(--text-3)", marginTop: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m4 4 16 16M20 4 4 20" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2.5">
            {[0, 150, 300].map((d) => <div key={d} className="size-2 rounded-full animate-pulse" style={{ background: "var(--border-2)", animationDelay: `${d}ms` }} />)}
          </div>
        ) : viewMode === "board" ? (
          <div className="flex items-stretch overflow-x-auto overflow-y-hidden flex-1">
            {visibleStatuses.map((status, idx) => {
              const colJobs = filteredJobs.filter((j) => j.status_id === status.id || (idx === 0 && teamView === "all" && (j.status_id === null || j.status_id === undefined)));
              if (search.trim() && colJobs.length === 0) return null;
              return (
              <AiropsColumn key={status.id} status={status}
                jobs={colJobs}
                selectedId={selectedJobId} onSelectCard={openPanel} onDrop={handleDrop} cardFields={cardFields} />
              );
            })}
          </div>
        ) : (
          <SheetsView jobs={filteredJobs} onSelectJob={openPanel} selectedId={selectedJobId} onSaveCell={handleSaveCell} />
        )}
        {isPanelOpen && <AiropsDetailPanel />}
      </div>
    </div>
  );
}
