"use client";

import { useState } from "react";

const FIELDS = [
  { key: "order_no",            label: "Order No",            type: "text",   required: true },
  { key: "consignee_name",      label: "Consignee Name",      type: "text",   required: true },
  { key: "shipper_name",        label: "Shipper Name",        type: "text",   required: true },
  { key: "quantity_pcs",        label: "Quantity (pcs)",      type: "number", required: false },
  { key: "volume",              label: "Volume (CBM)",        type: "number", required: false },
  { key: "no_of_cartons",       label: "No. of Cartons",      type: "number", required: false },
  { key: "cargo_handover_date", label: "Cargo Handover Date", type: "date",   required: false },
  { key: "gross_weight",        label: "Gross Weight (kg)",   type: "number", required: false },
  { key: "net_weight",          label: "Net Weight (kg)",     type: "number", required: false },
  { key: "pkgs_cases",          label: "Pkgs / Cases",        type: "text",   required: false },
] as const;

export default function BookingPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of FIELDS) {
        if (form[f.key]) {
          data[f.key] = f.type === "number" ? Number(form[f.key]) : form[f.key];
        }
      }
      const res = await fetch("/api/airops/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to submit");
      }
      const job = await res.json();
      setSuccess(job.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div
          className="max-w-sm w-full rounded-xl p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#dcfce7" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
            Booking Submitted
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>
            Your booking request has been received.
          </p>
          <p className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            Ref: {success.slice(0, 8).toUpperCase()}
          </p>
          <button
            onClick={() => { setSuccess(null); setForm({}); }}
            className="mt-6 w-full h-9 rounded-lg text-sm font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#6366f1" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 16.5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v9.5z" />
                <path d="M2 9h20" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
                Booking Request
              </h1>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                AirOps Sea Freight
              </p>
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Fill in your shipment details below. The ops team will review your request.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 space-y-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.key === "order_no" || f.key === "consignee_name" || f.key === "shipper_name" ? "col-span-2" : ""}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                  {f.label}
                  {f.required && <span style={{ color: "#ef4444" }}> *</span>}
                </label>
                <input
                  type={f.type}
                  value={form[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                  className="w-full h-9 rounded-lg px-3 text-sm"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-medium text-white mt-2"
            style={{ background: loading ? "#a5b4fc" : "#6366f1" }}
          >
            {loading ? "Submitting…" : "Submit Booking Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
