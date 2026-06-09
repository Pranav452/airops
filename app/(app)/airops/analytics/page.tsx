"use client";

import { useMemo } from "react";
import { useAiropsJobs, useAiropsStatuses, useAiropsVessels } from "@/lib/queries/airops";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 0,
      }}
    >
      <p
        style={{
          color: "var(--text-3)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {value !== undefined && (
        <p style={{ color: "var(--text)", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </p>
      )}
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
      {children}
    </p>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: jobs = [], isLoading } = useAiropsJobs();
  const { data: statuses = [] } = useAiropsStatuses();
  const { data: vessels = [] } = useAiropsVessels();

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j) => j.status?.name?.toLowerCase() === "completed").length;
    const activeJobs = totalJobs - completedJobs;
    const thisMonth = jobs.filter((j) => j.created_at?.startsWith(thisMonthPrefix)).length;

    // Volume / weight
    const volumes = jobs.map((j) => j.data.volume).filter((v): v is number => typeof v === "number");
    const avgVolume = volumes.length > 0 ? (volumes.reduce((a, b) => a + b, 0) / volumes.length).toFixed(2) : "—";
    const totalGrossWeight = jobs
      .map((j) => j.data.gross_weight)
      .filter((v): v is number => typeof v === "number")
      .reduce((a, b) => a + b, 0);

    // Job type counts
    const ccCount = jobs.filter((j) => j.data.job_type === "CC").length;
    const ffCount = jobs.filter((j) => j.data.job_type === "FF").length;
    const xwCount = jobs.filter((j) => j.data.job_type === "X Works").length;

    // Jobs by status
    const byStatus: Record<string, number> = {};
    for (const s of statuses) byStatus[s.id] = 0;
    for (const j of jobs) if (j.status_id) byStatus[j.status_id] = (byStatus[j.status_id] ?? 0) + 1;
    const statusRows = statuses
      .map((s) => ({ id: s.id, name: s.name, color: s.color_hex, count: byStatus[s.id] ?? 0 }))
      .filter((r) => r.count > 0);
    const maxStatusCount = Math.max(1, ...statusRows.map((r) => r.count));

    // Jobs by vessel
    const byVessel: Record<string, number> = {};
    for (const j of jobs) {
      const vName = j.container?.vessel?.name;
      if (vName) byVessel[vName] = (byVessel[vName] ?? 0) + 1;
    }
    const vesselRows = Object.entries(byVessel)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const maxVesselCount = Math.max(1, ...vesselRows.map((r) => r.count));

    // Monthly trend — last 6 months
    const monthlyData: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      const count = jobs.filter((j) => j.created_at?.startsWith(prefix)).length;
      monthlyData.push({ label, count });
    }
    const maxMonthCount = Math.max(1, ...monthlyData.map((m) => m.count));

    return {
      totalJobs, completedJobs, activeJobs, thisMonth,
      avgVolume, totalGrossWeight,
      ccCount, ffCount, xwCount,
      statusRows, maxStatusCount,
      vesselRows, maxVesselCount,
      monthlyData, maxMonthCount,
    };
  }, [jobs, statuses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-3)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const { totalJobs, completedJobs, activeJobs, thisMonth, avgVolume, totalGrossWeight,
    ccCount, ffCount, xwCount, statusRows, maxStatusCount, vesselRows, maxVesselCount,
    monthlyData, maxMonthCount } = stats;

  const totalTypeCount = Math.max(1, ccCount + ffCount + xwCount);

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text)" }}>Analytics</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Overview of all shipment activity
          </p>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{totalJobs} jobs total</span>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-8">

        {/* ── Row 1: 4 stat cards ── */}
        <div className="flex gap-4">
          <StatCard label="Total Jobs" value={totalJobs} />
          <StatCard label="Active Jobs" value={activeJobs} />
          <StatCard label="This Month" value={thisMonth} />
          <StatCard label="Completed" value={completedJobs} />
        </div>

        {/* ── Row 2: 3 stat cards ── */}
        <div className="flex gap-4">
          <StatCard label="Avg Volume (CBM)" value={avgVolume} />
          <StatCard
            label="Total Gross Weight"
            value={totalGrossWeight > 0 ? `${totalGrossWeight.toLocaleString()} kg` : "—"}
          />
          <StatCard label="Jobs by Type">
            <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "CC", count: ccCount, bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
                { label: "FF", count: ffCount, bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
                { label: "X Works", count: xwCount, bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
              ].map(({ label, count, bg, color, border }) => (
                <span
                  key={label}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    background: bg,
                    color,
                    border: `1px solid ${border}`,
                  }}
                >
                  {label} · {count}
                </span>
              ))}
            </div>
          </StatCard>
        </div>

        {/* ── Charts row 1: Status + Vessel ── */}
        <div className="flex gap-6">
          {/* Jobs by Status */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              flex: 1,
              minWidth: 0,
            }}
          >
            <SectionHeading>Jobs by Status</SectionHeading>
            {statusRows.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)" }}>No data</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {statusRows.map((row) => {
                  const color = row.color.startsWith("#") ? row.color : `#${row.color}`;
                  const pct = (row.count / maxStatusCount) * 100;
                  return (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, height: 28 }}>
                      <span
                        style={{
                          width: 100,
                          fontSize: 12,
                          color: "var(--text-2)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flexShrink: 0,
                        }}
                      >
                        {row.name}
                      </span>
                      <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: color,
                            borderRadius: 4,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", width: 24, textAlign: "right", flexShrink: 0 }}>
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Jobs by Vessel */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              flex: 1,
              minWidth: 0,
            }}
          >
            <SectionHeading>Jobs by Vessel</SectionHeading>
            {vesselRows.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)" }}>No data</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {vesselRows.slice(0, 10).map((row) => {
                  const pct = (row.count / maxVesselCount) * 100;
                  return (
                    <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 8, height: 28 }}>
                      <span
                        style={{
                          width: 120,
                          fontSize: 12,
                          color: "var(--text-2)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flexShrink: 0,
                        }}
                      >
                        {row.name}
                      </span>
                      <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "#6366f1",
                            borderRadius: 4,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", width: 24, textAlign: "right", flexShrink: 0 }}>
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Charts row 2: Job Type Distribution + Monthly Trend ── */}
        <div className="flex gap-6">
          {/* Job Type Distribution */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              flex: 1,
              minWidth: 0,
            }}
          >
            <SectionHeading>Job Type Distribution</SectionHeading>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "CC", count: ccCount, bg: "#6366f1", light: "#eef2ff", textColor: "#4f46e5" },
                { label: "FF", count: ffCount, bg: "#7c3aed", light: "#f5f3ff", textColor: "#7c3aed" },
                { label: "X Works", count: xwCount, bg: "#9333ea", light: "#fdf4ff", textColor: "#9333ea" },
              ].map(({ label, count, bg, light, textColor }) => {
                const pct = Math.round((count / totalTypeCount) * 100);
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      minWidth: 80,
                      background: light,
                      borderRadius: 12,
                      padding: "14px 16px",
                      border: `1px solid ${bg}33`,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 600, color: textColor, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: textColor, lineHeight: 1 }}>{count}</p>
                    <div style={{ marginTop: 8, background: `${bg}33`, borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: bg, borderRadius: 4 }} />
                    </div>
                    <p style={{ marginTop: 4, fontSize: 11, color: textColor, opacity: 0.7 }}>{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Trend */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              flex: 1,
              minWidth: 0,
            }}
          >
            <SectionHeading>Monthly Trend (last 6 months)</SectionHeading>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200 }}>
              {monthlyData.map((m) => {
                const heightPct = maxMonthCount > 0 ? (m.count / maxMonthCount) * 100 : 0;
                return (
                  <div
                    key={m.label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>{m.count || ""}</span>
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(heightPct, m.count > 0 ? 4 : 0)}%`,
                        background: m.count > 0 ? "#3b82f6" : "var(--surface-2)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.4s ease",
                        minHeight: m.count > 0 ? 4 : 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-3)",
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    >
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
