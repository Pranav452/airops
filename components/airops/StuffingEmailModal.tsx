"use client";

import { useState } from "react";
import type { AiropsJob } from "@/lib/types/airops";

interface Props {
  job: AiropsJob;
  onClose: () => void;
}

const POL_TEAM_EMAIL =
  process.env.NEXT_PUBLIC_POL_TEAM_EMAIL ?? "mpcargolille@gmail.com";

function quickRecipients(job: AiropsJob) {
  const consignee = job.data?.consignee_email?.trim();
  return [
    ...(consignee ? [{ label: "Consignee", value: consignee }] : []),
    { label: "POL Team", value: POL_TEAM_EMAIL },
  ];
}

function buildSubject(job: AiropsJob): string {
  const d = job.data ?? {};
  return `Stuffing Plan — ${d.order_no ?? "N/A"} — ${d.vessel_name ?? job.container?.vessel?.name ?? "N/A"}`;
}

function buildBody(job: AiropsJob): string {
  const d = job.data ?? {};
  const vesselName = d.vessel_name ?? job.container?.vessel?.name ?? "N/A";
  const containers = (d.container_numbers ?? []).join(", ") || "N/A";

  return `Dear ${d.consignee_name ?? "Sir/Madam"},

Please find below the Stuffing Finalisation summary for your shipment:

Order No.       : ${d.order_no ?? "N/A"}
Vessel          : ${vesselName}
ETD             : ${d.etd ?? "N/A"}
Container(s)    : ${containers}

Cargo Details
─────────────────────────────────────
Quantity (pcs)  : ${d.quantity_pcs ?? "N/A"}
Volume (CBM)    : ${d.volume ?? "N/A"}
Gross Weight    : ${d.gross_weight ?? "N/A"} kg
Net Weight      : ${d.net_weight ?? "N/A"} kg
Pkgs / Cases    : ${d.pkgs_cases ?? "N/A"}
Cargo Handover  : ${d.cargo_handover_date ?? "N/A"}

Kindly acknowledge receipt and confirm all details are in order.

Best regards,
AirOps Export Team`;
}

export function StuffingEmailModal({ job, onClose }: Props) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(() => buildSubject(job));
  const [body, setBody] = useState(() => buildBody(job));
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [lastAction, setLastAction] = useState<"send" | "draft">("send");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(sendNow: boolean) {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setErrorMsg("Fill in To, Subject, and Body.");
      return;
    }
    setStatus("sending");
    setLastAction(sendNow ? "send" : "draft");
    setErrorMsg("");

    try {
      const res = await fetch("/api/airops/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject,
          emailBody: body,
          sendNow,
        }),
      });
      const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (data.success) {
        setStatus("done");
        setTimeout(onClose, 1400);
      } else {
        throw new Error(data.error ?? JSON.stringify(data));
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: "0 24px 24px 0",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 12,
          width: 600,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            Stuffing Finalisation — Email Consignee
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Quick recipient chips */}
        <div
          style={{
            padding: "10px 16px",
            background: "var(--surface-2, #fafafa)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {quickRecipients(job).map((q) => (
            <button
              key={q.value}
              onClick={() => setTo(q.value)}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: to === q.value ? "#111" : "var(--surface, #fff)",
                color: to === q.value ? "#fff" : "var(--text-2, #6b7280)",
                border: "1px solid",
                borderColor: to === q.value ? "#111" : "var(--border)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ padding: "10px 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {(
            [
              { label: "To", value: to, set: setTo, placeholder: "recipient@example.com" },
              { label: "Cc", value: cc, set: setCc, placeholder: "optional" },
              { label: "Subject", value: subject, set: setSubject, placeholder: "Email subject" },
            ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]
          ).map(({ label, value, set, placeholder }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-3, #9ca3af)", minWidth: 48, fontWeight: 500 }}>
                {label}
              </span>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--text, #111827)",
                  background: "transparent",
                  fontFamily: "inherit",
                }}
              />
            </div>
          ))}
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{
            flex: 1,
            margin: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12.5,
            lineHeight: 1.65,
            resize: "vertical",
            fontFamily: "monospace",
            outline: "none",
            minHeight: 260,
            color: "var(--text, #111827)",
            background: "var(--surface-2, #fafafa)",
          }}
        />

        {/* Error */}
        {errorMsg && (
          <div style={{ margin: "0 14px", fontSize: 11, color: "#dc2626", padding: "4px 0" }}>
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {status === "done" && (
            <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
              {lastAction === "send" ? "Sent!" : "Saved as draft!"}
            </span>
          )}
          <button
            onClick={() => submit(false)}
            disabled={status === "sending"}
            className="btn-ghost"
            style={{ fontSize: 12 }}
          >
            Save Draft
          </button>
          <button
            onClick={() => submit(true)}
            disabled={status === "sending"}
            className="btn-primary"
            style={{ fontSize: 12 }}
          >
            {status === "sending" ? "Saving…" : "Send Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
