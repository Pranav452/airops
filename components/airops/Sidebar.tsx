"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConsigneeApprovalBell } from "@/components/airops/ConsigneeApprovalBell";
import { useAiropsStore } from "@/lib/stores/airops-store";

const NAV = [
  {
    href: "/airops/board",
    label: "Board",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="10" rx="1" />
        <rect x="14" y="17" width="7" height="4" rx="1" />
      </svg>
    ),
  },
  {
    href: "/airops/canvas",
    label: "Canvas",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="6" cy="8" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="12" cy="17" r="2" />
        <path d="M8 8h8M7 10l4 6M17 10l-4 6" />
      </svg>
    ),
  },
  {
    href: "/airops/dockyard",
    label: "Dockyard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
        <path d="M7 20V12a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8" />
        <path d="M12 12V8M8 8h8M5 12H2l2-7h14l2 7h-3" />
      </svg>
    ),
  },
  {
    href: "/airops/export",
    label: "Export",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    href: "/airops/analytics",
    label: "Analytics",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
];

const TEAM_CONFIG = {
  pol: {
    label: "POL",
    full: "POL Team",
    sub: "Export · Origin",
    bg: "#eef2ff",
    color: "#4f46e5",
    border: "#c7d2fe",
  },
  france: {
    label: "FR",
    full: "France Team",
    sub: "Import · Destination",
    bg: "#fdf4ff",
    color: "#9333ea",
    border: "#e9d5ff",
  },
};

export function Sidebar({ userEmail, team }: { userEmail: string; team?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const tc = team && team in TEAM_CONFIG ? TEAM_CONFIG[team as keyof typeof TEAM_CONFIG] : null;
  const { globalSearch, setGlobalSearch } = useAiropsStore();

  return (
    <aside
      className="group/nav w-14 hover:w-52 transition-[width] duration-200 ease-in-out flex flex-col shrink-0 h-full py-3 overflow-hidden"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo row */}
      <div className="flex items-center h-10 px-3 mb-4 gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#6366f1" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v9.5z" />
            <path d="M2 9h20" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0 flex-1 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
          <span className="text-sm font-semibold leading-none whitespace-nowrap" style={{ color: "var(--text)" }}>AirOps</span>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap" style={{ color: "var(--text-3)" }}>Sea Freight</span>
        </div>
        <div className="opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75 shrink-0">
          <ConsigneeApprovalBell team={team || "pol"} />
        </div>
      </div>

      {/* Team badge */}
      {tc && (
        <div
          className="mx-2 mb-4 rounded-lg overflow-hidden"
          style={{
            background: tc.bg,
            border: `1px solid ${tc.border}`,
          }}
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold"
              style={{ background: tc.color, color: "white" }}
            >
              {tc.label}
            </div>
            <div className="flex flex-col min-w-0 flex-1 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
              <span className="text-xs font-semibold leading-none whitespace-nowrap" style={{ color: tc.color }}>
                {tc.full}
              </span>
              <span className="text-[9px] mt-0.5 leading-none opacity-70 whitespace-nowrap" style={{ color: tc.color }}>
                {tc.sub}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-2 mb-3" style={{ height: 1, background: "var(--border)" }} />

      {/* Global search */}
      <div className="px-2 mb-2">
        <div className="flex items-center gap-2 h-8 rounded-lg px-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0" style={{ color: "var(--text-3)" }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent text-[12px] min-w-0 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75 w-0 group-hover/nav:w-auto"
            style={{ color: "var(--text)", border: "none", outline: "none" }}
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              className="opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75 shrink-0"
              style={{ color: "var(--text-3)" }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 h-9 px-2.5 rounded-lg transition-colors"
              style={{
                background: active ? "#eef2ff" : "transparent",
                color: active ? "#6366f1" : "var(--text-3)",
              }}
            >
              {item.icon}
              <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full h-9 px-2.5 rounded-lg transition-colors"
          style={{ color: "#ef4444" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <div className="flex flex-col min-w-0 flex-1 text-left opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            <span className="text-[10px] truncate leading-none" style={{ color: "var(--text-3)" }}>{userEmail}</span>
            <span className="text-sm font-medium leading-none mt-0.5 whitespace-nowrap" style={{ color: "#ef4444" }}>Sign out</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
