"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAiropsStore } from "@/lib/stores/airops-store";
import type { AiropsJob } from "@/lib/types/airops";

interface Props {
  team: string;
}

export function ConsigneeApprovalBell({ team }: Props) {
  const [jobs, setJobs] = useState<AiropsJob[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { openPanel } = useAiropsStore();
  const router = useRouter();

  async function fetchFranceJobs() {
    const sb = createClient();
    const { data: statusData } = await sb
      .from("airops_statuses")
      .select("id")
      .eq("name", "Consignee Approval")
      .single();

    if (!statusData) return;

    const { data, error } = await sb
      .from("airops_jobs")
      .select(`*, status:airops_statuses(*), container:airops_containers(*, vessel:airops_vessels(*))`)
      .eq("status_id", statusData.id)
      .order("column_order");

    if (error) return;
    setJobs((data as AiropsJob[]) ?? []);
  }

  async function fetchPolJobs() {
    const sb = createClient();
    const { data, error } = await sb
      .from("airops_jobs")
      .select(`*, status:airops_statuses(*), container:airops_containers(*, vessel:airops_vessels(*))`)
      .order("column_order");

    if (error) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 2);
    cutoff.setHours(23, 59, 59, 999);

    const filtered = ((data as AiropsJob[]) ?? []).filter((job) => {
      const etd = job.data?.etd ? new Date(job.data.etd as string) : null;
      if (!etd) return false;
      const statusName = (job.status as { name?: string } | null)?.name ?? "";
      if (statusName === "Completed") return false;
      return etd <= cutoff;
    });

    setJobs(filtered);
  }

  useEffect(() => {
    if (team === "france") {
      fetchFranceJobs();
      const interval = setInterval(fetchFranceJobs, 30_000);
      return () => clearInterval(interval);
    } else if (team === "pol") {
      fetchPolJobs();
      const interval = setInterval(fetchPolJobs, 30_000);
      return () => clearInterval(interval);
    }
  }, [team]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  function handleOpen(jobId: string) {
    setOpen(false);
    openPanel(jobId);
  }

  function handleViewAll() {
    setOpen(false);
    router.push("/airops/board");
  }

  const badgeCount = jobs.length;
  const isFrance = team === "france";
  const accentColor = isFrance ? "#6366f1" : "#f59e0b";
  const bellLabel = isFrance ? "Consignee Approval jobs" : "Cutoffs & Alerts";
  const panelTitle = isFrance ? "Consignee Approval" : "Cutoffs & Alerts";

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center size-[30px] rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
        aria-label={bellLabel}
        title={bellLabel}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white tabular-nums flex items-center justify-center">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {/* Floating dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            width: 320,
            background: "white",
            borderRadius: 16,
            border: "1px solid var(--border, #e5e7eb)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{panelTitle}</span>
              {badgeCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: accentColor,
                    background: isFrance ? "#eef2ff" : "#fffbeb",
                    border: `1px solid ${isFrance ? "#c7d2fe" : "#fde68a"}`,
                    borderRadius: 999,
                    padding: "1px 7px",
                    lineHeight: 1.6,
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {badgeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setJobs([])}
                  style={{
                    fontSize: 11,
                    color: "var(--text-3, #9ca3af)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                  className="hover:text-gray-600"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
                className="hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="m4 4 16 16M20 4 4 20" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px 0" }}>
            {jobs.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "32px 16px",
                  gap: 8,
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3, #9ca3af)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{ fontSize: 13, color: "var(--text-3, #9ca3af)" }}>All clear!</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
                {jobs.map((job) => {
                  const dateVal = isFrance
                    ? (job.data?.eta ? String(job.data.eta) : null)
                    : (job.data?.etd ? String(job.data.etd) : null);
                  const dateLabel = isFrance ? "ETA" : "ETD";
                  const displayDate = dateVal
                    ? new Date(dateVal).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                    : null;

                  return (
                    <div
                      key={job.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderRadius: 10,
                        padding: "8px 10px 8px 0",
                        cursor: "default",
                        transition: "background 0.15s",
                        overflow: "hidden",
                      }}
                      className="hover:bg-gray-50"
                    >
                      {/* Left accent bar */}
                      <div
                        style={{
                          width: 3,
                          alignSelf: "stretch",
                          borderRadius: 999,
                          background: accentColor,
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      />
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.data?.order_no ?? "—"}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-3, #9ca3af)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.data?.consignee_name ?? "—"}
                          {job.data?.shipper_name ? (
                            <span style={{ color: "#d1d5db" }}> · {String(job.data.shipper_name)}</span>
                          ) : null}
                        </p>
                      </div>
                      {/* Date chip */}
                      {displayDate && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: "#6b7280",
                            background: "#f3f4f6",
                            border: "1px solid #e5e7eb",
                            borderRadius: 6,
                            padding: "2px 6px",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {dateLabel} {displayDate}
                        </span>
                      )}
                      {/* Open button */}
                      <button
                        type="button"
                        onClick={() => handleOpen(job.id)}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: accentColor,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 4px",
                          borderRadius: 6,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                        className="hover:underline"
                      >
                        Open →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: "1px solid var(--border, #e5e7eb)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleViewAll}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: accentColor,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              className="hover:underline"
            >
              View all on board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
