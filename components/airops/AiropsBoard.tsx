"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAiropsStatuses,
  useAiropsJobs,
  useAiropsVessels,
  useUpdateJob,
} from "@/lib/queries/airops";
import { useAiropsStore } from "@/lib/stores/airops-store";
import { AiropsColumn } from "@/components/airops/AiropsColumn";
import { AiropsDetailPanel } from "@/components/airops/AiropsDetailPanel";
import { createClient } from "@/lib/supabase/client";
import type { AiropsFilters } from "@/lib/types/airops";

type TeamView = "all" | "pol" | "france";

const TEAM_LABELS: Record<TeamView, string> = {
  all: "All columns",
  pol: "POL Team",
  france: "France Team",
};

const TEAM_COLORS: Record<TeamView, { bg: string; color: string; border: string }> = {
  all: { bg: "#f8fafc", color: "var(--text-2)", border: "var(--border)" },
  pol:    { bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  france: { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
};

export function AiropsBoard() {
  const [search, setSearch] = useState("");
  const [vesselFilter, setVesselFilter] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<TeamView>("all");

  // Read team from user metadata on mount — default board to their team
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const t = data.user?.user_metadata?.team;
      if (t === "pol" || t === "france") setTeamView(t);
    });
  }, []);

  const filters: AiropsFilters = {
    search: search || undefined,
    vessel_id: vesselFilter ?? undefined,
  };

  const { data: statuses = [], isLoading: statusLoading } = useAiropsStatuses();
  const { data: jobs = [], isLoading: jobsLoading } = useAiropsJobs(filters);
  const { data: vessels = [] } = useAiropsVessels();
  const updateJob = useUpdateJob();
  const { selectedJobId, isPanelOpen, openPanel, closePanel } = useAiropsStore();

  // Filter statuses by team view
  const visibleStatuses =
    teamView === "pol"
      ? statuses.filter((s) => s.display_order <= 15)
      : teamView === "france"
      ? statuses.filter((s) => s.display_order > 15)
      : statuses;

  function handleDrop(jobId: string, newStatusId: string, newOrder: number) {
    updateJob.mutate({ id: jobId, updates: { status_id: newStatusId, column_order: newOrder } });
  }

  const isLoading = statusLoading || jobsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {/* Title */}
        <div className="flex items-center gap-2 mr-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#6366f1" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="10" rx="1" />
              <rect x="14" y="17" width="7" height="4" rx="1" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            AirOps Board
          </span>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 h-8 rounded-lg px-3 min-w-[200px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: "var(--text-3)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="flex-1 bg-transparent text-[13px]"
            style={{ color: "var(--text)", border: "none", outline: "none" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "var(--text-3)" }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          )}
        </div>

        {/* Vessel filter chips */}
        {vessels.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setVesselFilter(null)}
              className="px-2.5 h-7 rounded-md text-xs font-medium shrink-0 transition-colors"
              style={{
                background: vesselFilter === null ? "#6366f1" : "var(--surface-2)",
                color: vesselFilter === null ? "white" : "var(--text-2)",
                border: vesselFilter === null ? "none" : "1px solid var(--border)",
              }}
            >
              All vessels
            </button>
            {vessels.map((v) => (
              <button
                key={v.id}
                onClick={() => setVesselFilter(v.id === vesselFilter ? null : v.id)}
                className="px-2.5 h-7 rounded-md text-xs font-medium shrink-0 transition-colors"
                style={{
                  background: vesselFilter === v.id ? "#6366f1" : "var(--surface-2)",
                  color: vesselFilter === v.id ? "white" : "var(--text-2)",
                  border: vesselFilter === v.id ? "none" : "1px solid var(--border)",
                }}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {/* Team view toggle */}
        <div className="flex items-center rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
          {(["all", "pol", "france"] as TeamView[]).map((t) => {
            const active = teamView === t;
            const tc = TEAM_COLORS[t];
            return (
              <button
                key={t}
                onClick={() => setTeamView(t)}
                className="px-3 h-7 text-xs font-medium transition-colors"
                style={{
                  background: active ? tc.bg : "var(--surface-2)",
                  color: active ? tc.color : "var(--text-3)",
                  borderRight: t !== "france" ? "1px solid var(--border)" : "none",
                }}
              >
                {TEAM_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>

        {/* Canvas link */}
        <Link
          href="/airops/canvas"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="8" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="12" cy="17" r="2" />
            <path d="M8 8h8M7 10l4 6M17 10l-4 6" />
          </svg>
          Canvas
        </Link>

        {/* New job */}
        <Link
          href="/booking"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white"
          style={{ background: "#6366f1" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Job
        </Link>
      </div>

      {/* Columns area */}
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2.5">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="size-2 rounded-full animate-pulse"
                style={{ background: "var(--border-2)", animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-stretch overflow-x-auto overflow-y-hidden flex-1">
            {visibleStatuses.map((status, idx) => (
              <AiropsColumn
                key={status.id}
                status={status}
                jobs={jobs.filter(
                  (j) =>
                    j.status_id === status.id ||
                    (idx === 0 && teamView === "all" && (j.status_id === null || j.status_id === undefined))
                )}
                selectedId={selectedJobId}
                onSelectCard={openPanel}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}

        {/* Detail panel */}
        {isPanelOpen && <AiropsDetailPanel />}
      </div>
    </div>
  );
}
