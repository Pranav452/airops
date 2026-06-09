"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const JOB_TYPE_OPTIONS = [
  { value: "cc",      label: "CC – Custom Clearance" },
  { value: "ff",      label: "FF – Freight Forwarding" },
  { value: "x_works", label: "X Works – Ex-Works" },
];

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

type UploadedFile = { name: string; path: string; size: number };

export default function BookingPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) => f.size <= 20 * 1024 * 1024);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !names.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  async function uploadFiles(jobId: string): Promise<UploadedFile[]> {
    const sb = createClient();
    const results: UploadedFile[] = [];
    for (const file of files) {
      const path = `${jobId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await sb.storage.from("job-documents").upload(path, file);
      if (!upErr) results.push({ name: file.name, path, size: file.size });
    }
    return results;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.job_type) { setError("Please select a Job Type."); return; }
    setLoading(true);
    setUploading(files.length > 0);
    try {
      const data: Record<string, unknown> = {};
      for (const f of FIELDS) {
        if (form[f.key]) {
          data[f.key] = f.type === "number" ? Number(form[f.key]) : form[f.key];
        }
      }
      data.job_type = form.job_type;

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

      // Upload documents after job is created
      if (files.length > 0) {
        const uploaded = await uploadFiles(job.id);
        if (uploaded.length > 0) {
          await fetch(`/api/airops/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { documents: uploaded } }),
          });
        }
      }

      setSuccess(job.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setUploading(false);
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
            onClick={() => { setSuccess(null); setForm({}); setFiles([]); }}
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

            {/* Job Type */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Job Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={form.job_type ?? ""}
                onChange={(e) => handleChange("job_type", e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: form.job_type ? "var(--text)" : "var(--text-3)",
                  outline: "none",
                }}
              >
                <option value="" disabled>Select job type…</option>
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
              Invoice &amp; Packing List
              <span className="ml-1" style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional — PDF, images, Excel)</span>
            </label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#6366f1" : "var(--border)"}`,
                background: dragOver ? "#eef2ff" : "var(--surface-2)",
                borderRadius: 10,
                padding: "18px 12px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "#6366f1" : "var(--text-3)"} strokeWidth="1.6" strokeLinecap="round" className="mx-auto mb-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm" style={{ color: dragOver ? "#6366f1" : "var(--text-3)" }}>
                {dragOver ? "Drop files here" : "Drag & drop or click to select"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Max 20 MB per file</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.doc,.docx"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {files.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-xs truncate" style={{ color: "var(--text-2)" }}>{f.name}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            {uploading ? "Uploading documents…" : loading ? "Submitting…" : "Submit Booking Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
