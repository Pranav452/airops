"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import AiropsComposeModal from "./AiropsComposeModal";

export default function AiropsComposeLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating compose button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close compose" : "Compose email"}
        title={open ? "Close compose" : "Compose email"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 540,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: open ? "#4f46e5" : "#6366f1",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(99,102,241,0.45), 0 2px 6px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s, transform 0.15s",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = open ? "#4f46e5" : "#6366f1";
        }}
      >
        {open ? <CloseIcon /> : <ComposeIcon />}
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <AiropsComposeModal onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ComposeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
