"use client";

import React, { useRef, useState } from "react";
import { AiropsCard } from "@/components/airops/AiropsCard";
import type { AiropsStatus, AiropsJob } from "@/lib/types/airops";

interface AiropsColumnProps {
  status: AiropsStatus;
  jobs: AiropsJob[];
  selectedId: string | null;
  onSelectCard: (id: string) => void;
  onDrop: (jobId: string, newStatusId: string, newOrder: number) => void;
}

function DropIndicator({ beforeId, statusId }: { beforeId: string | null; statusId: string }) {
  return (
    <div
      data-before={beforeId ?? "-1"}
      data-status={statusId}
      className="my-0.5 h-0.5 w-full rounded-full opacity-0 transition-opacity"
      style={{ background: "#6366f1" }}
    />
  );
}

export function AiropsColumn({ status, jobs, selectedId, onSelectCard, onDrop }: AiropsColumnProps) {
  const [active, setActive] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const hexColor = `#${status.color_hex.replace(/^#/, "")}`;

  function getIndicators() {
    return Array.from(document.querySelectorAll<HTMLElement>(`[data-status="${status.id}"]`));
  }

  function getNearestIndicator(e: React.DragEvent, indicators: HTMLElement[]) {
    const OFFSET = 50;
    return indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + OFFSET);
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: indicators[indicators.length - 1] }
    );
  }

  function clearHighlights(els?: HTMLElement[]) {
    (els ?? getIndicators()).forEach((i) => (i.style.opacity = "0"));
  }

  function handleDragStart(e: React.DragEvent, job: AiropsJob) {
    e.dataTransfer.setData("jobId", job.id);
    e.dataTransfer.setData("fromStatusId", job.status_id ?? "");
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const indicators = getIndicators();
    clearHighlights(indicators);
    const el = getNearestIndicator(e, indicators);
    el.element.style.opacity = "1";
    setActive(true);
  }

  function handleDragLeave() {
    clearHighlights();
    setActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    clearHighlights();
    setActive(false);
    const jobId = e.dataTransfer.getData("jobId");
    if (!jobId) return;
    const indicators = getIndicators();
    const { element } = getNearestIndicator(e, indicators);
    const before = element.dataset.before ?? "-1";
    if (before === jobId) return;
    let newOrder: number;
    const sorted = [...jobs].sort((a, b) => a.column_order - b.column_order);
    if (before === "-1") {
      const last = sorted[sorted.length - 1];
      newOrder = last ? last.column_order + 1 : 1;
    } else {
      const beforeJob = sorted.find((j) => j.id === before);
      const idx = sorted.findIndex((j) => j.id === before);
      const prevJob = idx > 0 ? sorted[idx - 1] : null;
      newOrder =
        prevJob && beforeJob
          ? (prevJob.column_order + beforeJob.column_order) / 2
          : beforeJob
          ? beforeJob.column_order - 0.5
          : 1;
    }
    onDrop(jobId, status.id, newOrder);
  }

  const sorted = [...jobs].sort((a, b) => a.column_order - b.column_order);
  const filtered = search.trim()
    ? sorted.filter((j) =>
        JSON.stringify(j.data).toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 260,
        borderRight: "1px solid var(--border)",
        minHeight: "100%",
        background: "var(--surface)",
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0 group"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        {searchOpen ? (
          <div className="flex items-center gap-1.5 flex-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: "var(--text-3)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setSearchOpen(false), setSearch(""))}
              placeholder={`Search…`}
              className="flex-1 bg-transparent text-xs"
              style={{ color: "var(--text)", outline: "none", border: "none" }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearch(""); }}
              style={{ color: "var(--text-3)" }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </div>
        ) : (
          <>
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: hexColor }}
            />
            <span
              className="text-[12.5px] font-semibold flex-1 truncate"
              style={{ color: "var(--text)" }}
            >
              {status.name}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
              {jobs.length}
            </span>
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-3)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 p-2 overflow-y-auto"
        style={{
          minHeight: 120,
          background: active ? "#f0f0fe" : "transparent",
          transition: "background 0.15s",
        }}
      >
        {filtered.map((job) => (
          <React.Fragment key={job.id}>
            <DropIndicator beforeId={job.id} statusId={status.id} />
            <AiropsCard
              job={job}
              isSelected={selectedId === job.id}
              statusColor={status.color_hex}
              onSelect={() => onSelectCard(job.id)}
              onDragStart={(e) => handleDragStart(e, job)}
            />
          </React.Fragment>
        ))}
        <DropIndicator beforeId={null} statusId={status.id} />

        {filtered.length === 0 && (
          <div
            className="flex items-center justify-center h-14 rounded-lg border border-dashed text-xs mt-1"
            style={{
              borderColor: active ? "#6366f1" : "var(--border-2)",
              color: active ? "#6366f1" : "var(--text-3)",
            }}
          >
            {active ? "Drop here" : search.trim() ? "No matches" : "Empty"}
          </div>
        )}
      </div>
    </div>
  );
}
