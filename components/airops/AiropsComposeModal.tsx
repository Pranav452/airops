"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useJobSearch, useAiDraft, type JobSearchResult } from "@/lib/queries/airops-mail";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ─── Prompt input with @ detection ───────────────────────────────────────────

/** Extracts the @ query at the caret position in a textarea */
function getAtQuery(text: string, caretPos: number): string | null {
  const before = text.slice(0, caretPos);
  const match = before.match(/@([\w\-\/\.]*)$/);
  return match ? match[1] : null;
}

// ─── Job Dropdown ─────────────────────────────────────────────────────────────

interface JobDropdownProps {
  results: JobSearchResult[];
  loading: boolean;
  activeIndex: number;
  onSelect: (job: JobSearchResult) => void;
  onSetActive: (i: number) => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

function JobDropdown({
  results,
  loading,
  activeIndex,
  onSelect,
  onSetActive,
  anchorRef,
}: JobDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    const el = dropdownRef.current?.querySelector<HTMLDivElement>(
      `[data-idx="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "absolute",
        bottom: "calc(100% + 4px)",
        left: 0,
        right: 0,
        background: "var(--surface, #fff)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        zIndex: 600,
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      {loading && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-3, #9ca3af)",
          }}
        >
          Searching…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-3, #9ca3af)",
          }}
        >
          No jobs found
        </div>
      )}
      {results.map((job, i) => (
        <div
          key={job.id}
          data-idx={i}
          onMouseEnter={() => onSetActive(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(job);
          }}
          style={{
            padding: "9px 14px",
            cursor: "pointer",
            background:
              i === activeIndex
                ? "var(--surface-2, #f3f4f6)"
                : "transparent",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            borderBottom:
              i < results.length - 1
                ? "1px solid var(--border, #e5e7eb)"
                : "none",
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text, #111827)",
            }}
          >
            {job.order_no}
          </span>
          {job.consignee_name && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-3, #9ca3af)",
              }}
            >
              {job.consignee_name}
            </span>
          )}
        </div>
      ))}
    </motion.div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
function FieldRow({ label, value, onChange, placeholder }: FieldRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid var(--border, #e5e7eb)",
        paddingBottom: 6,
        marginBottom: 2,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-3, #9ca3af)",
          minWidth: 52,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AiropsComposeModal({ onClose }: Props) {
  // Prompt state
  const [promptText, setPromptText] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [dropdownActive, setDropdownActive] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Email fields
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Submit state
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [lastAction, setLastAction] = useState<"send" | "draft">("send");

  // Hooks
  const jobSearch = useJobSearch(atQuery ?? "");
  const aiDraft = useAiDraft();

  const showDropdown = atQuery !== null && (jobSearch.data?.length ?? 0) > 0;

  // ── @-mention detection ──────────────────────────────────────────────────

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setPromptText(val);
      const caret = e.target.selectionStart ?? val.length;
      const q = getAtQuery(val, caret);
      setAtQuery(q);
      setDropdownActive(0);
      // Clear selected job if user removes the @ mention text
      if (q === null && selectedJob) {
        const orderNoPresent = val.includes(`@${selectedJob.order_no}`);
        if (!orderNoPresent) setSelectedJob(null);
      }
    },
    [selectedJob]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown) return;
      const results = jobSearch.data ?? [];
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownActive((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        const job = results[dropdownActive];
        if (job) {
          e.preventDefault();
          selectJob(job);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setAtQuery(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showDropdown, jobSearch.data, dropdownActive]
  );

  const selectJob = useCallback(
    (job: JobSearchResult) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const caret = ta.selectionStart ?? promptText.length;
      const before = promptText.slice(0, caret);
      // Replace "@<query>" with "@ORDER_NO "
      const replaced = before.replace(/@([\w\-\/\.]*)$/, `@${job.order_no} `);
      const after = promptText.slice(caret);
      const newText = replaced + after;
      setPromptText(newText);
      setSelectedJob(job);
      setAtQuery(null);
      setDropdownActive(0);
      // Re-focus textarea and move caret to after the pill
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(replaced.length, replaced.length);
      });
    },
    [promptText]
  );

  // Click-outside to close dropdown
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setAtQuery(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── AI Draft ─────────────────────────────────────────────────────────────

  const handleDraftWithAi = useCallback(async () => {
    if (!selectedJob) {
      setSubmitError("Type @ to reference a job first.");
      return;
    }
    // Strip the @ORDER_NO from the instruction
    const instruction = promptText
      .replace(new RegExp(`@${selectedJob.order_no}\\s*`, "g"), "")
      .trim();
    if (!instruction) {
      setSubmitError("Please add an instruction after the job reference.");
      return;
    }
    setSubmitError("");
    try {
      const result = await aiDraft.mutateAsync({
        job_id: selectedJob.id,
        instruction,
      });
      setTo(result.to ?? "");
      setCc(result.cc ?? "");
      setSubject(result.subject ?? "");
      setBody(result.body ?? "");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "AI draft failed.");
    }
  }, [selectedJob, promptText, aiDraft]);

  // ── Send / Save Draft ─────────────────────────────────────────────────────

  const submit = useCallback(
    async (sendNow: boolean) => {
      if (!to.trim() || !subject.trim() || !body.trim()) {
        setSubmitError("Fill in To, Subject, and Body before sending.");
        return;
      }
      setSubmitStatus("sending");
      setLastAction(sendNow ? "send" : "draft");
      setSubmitError("");
      try {
        const res = await fetch("/api/airops/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: selectedJob?.id ?? undefined,
            to: to.trim(),
            cc: cc.trim() || undefined,
            subject: subject.trim(),
            emailBody: body.trim(),
            sendNow,
          }),
        });
        const data = await res
          .json()
          .catch(() => ({ error: `Server error ${res.status}` }));
        if (data.success) {
          setSubmitStatus("done");
          setTimeout(onClose, 1400);
        } else {
          throw new Error(data.error ?? data.smtpError ?? JSON.stringify(data));
        }
      } catch (e) {
        setSubmitStatus("error");
        setSubmitError(e instanceof Error ? e.message : String(e));
      }
    },
    [to, cc, subject, body, selectedJob, onClose]
  );

  // ─────────────────────────────────────────────────────────────────────────

  const isDrafting = aiDraft.isPending;
  const isSending = submitStatus === "sending";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      style={{
        position: "fixed",
        bottom: 80,
        right: 24,
        width: 460,
        maxHeight: "80vh",
        zIndex: 550,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface, #fff)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 16,
        boxShadow:
          "0 24px 64px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "var(--surface-2, #f9fafb)",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            color: "var(--text, #111827)",
            letterSpacing: "-0.01em",
          }}
        >
          New Email
        </span>
        <button
          onClick={onClose}
          aria-label="Close compose"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-3, #9ca3af)",
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
            padding: "0 2px",
            borderRadius: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div
        style={{
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* AI Prompt section */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface-2, #f9fafb)",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--text-3, #9ca3af)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            AI Instruction
          </div>
          {/* Prompt container — relative so dropdown sits above */}
          <div ref={containerRef} style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={promptText}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              placeholder="Tell AI what to write — type @ to reference a job"
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                padding: "9px 11px",
                fontSize: 13,
                lineHeight: 1.55,
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                color: "var(--text, #111827)",
                background: "var(--surface, #fff)",
              }}
            />
            <AnimatePresence>
              {showDropdown && (
                <JobDropdown
                  results={jobSearch.data ?? []}
                  loading={jobSearch.isFetching}
                  activeIndex={dropdownActive}
                  onSelect={selectJob}
                  onSetActive={setDropdownActive}
                  anchorRef={textareaRef}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Selected job pill */}
          {selectedJob && (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#eef2ff",
                  border: "1px solid #c7d2fe",
                  borderRadius: 20,
                  padding: "3px 10px",
                  fontSize: 11.5,
                  color: "#4338ca",
                  fontWeight: 600,
                }}
              >
                <span style={{ opacity: 0.6, fontSize: 10 }}>JOB</span>
                {selectedJob.order_no}
                {selectedJob.consignee_name && (
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>
                    · {selectedJob.consignee_name}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedJob(null);
                    setPromptText((t) =>
                      t.replace(
                        new RegExp(`@${selectedJob.order_no}\\s*`, "g"),
                        ""
                      )
                    );
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6366f1",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: 0,
                    marginLeft: 2,
                  }}
                  aria-label="Remove job reference"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleDraftWithAi}
            disabled={isDrafting || !selectedJob}
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isDrafting ? "#a5b4fc" : "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: isDrafting || !selectedJob ? "not-allowed" : "pointer",
              opacity: !selectedJob ? 0.55 : 1,
              transition: "background 0.15s",
            }}
          >
            {isDrafting ? (
              <>
                <SpinnerIcon />
                Drafting…
              </>
            ) : (
              <>
                <SparkleIcon />
                Draft with AI
              </>
            )}
          </button>
        </div>

        {/* Email fields */}
        <div style={{ padding: "10px 14px 4px" }}>
          <FieldRow
            label="To"
            value={to}
            onChange={setTo}
            placeholder="recipient@example.com"
          />
          <FieldRow label="CC" value={cc} onChange={setCc} placeholder="optional" />
          <FieldRow
            label="Subject"
            value={subject}
            onChange={setSubject}
            placeholder="Email subject"
          />
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Email body…"
          style={{
            margin: "6px 14px 10px",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12.5,
            lineHeight: 1.65,
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
            minHeight: 180,
            color: "var(--text, #111827)",
            background: "var(--surface-2, #f9fafb)",
          }}
        />
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border, #e5e7eb)",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "var(--surface, #fff)",
        }}
      >
        {/* Left: error / success */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {(submitStatus === "error" || submitError) && (
            <p
              style={{
                fontSize: 11.5,
                color: "#dc2626",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={submitError}
            >
              {submitError}
            </p>
          )}
          {submitStatus === "done" && (
            <p style={{ fontSize: 12, color: "#16a34a", margin: 0, fontWeight: 600 }}>
              {lastAction === "send" ? "Email sent!" : "Saved as draft!"}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => submit(false)}
            disabled={isSending}
            style={{
              background: "none",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: isSending ? "not-allowed" : "pointer",
              color: "var(--text-2, #6b7280)",
              fontWeight: 500,
            }}
          >
            Save Draft
          </button>
          <button
            onClick={() => submit(true)}
            disabled={isSending}
            style={{
              background: isSending ? "#a5b4fc" : "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: isSending ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}
