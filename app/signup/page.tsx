"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [team, setTeam] = useState<"pol" | "france" | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!team) { setError("Select your team first"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password min 6 characters"); return; }
    setLoading(true);
    const sb = createClient();
    const { error: err } = await sb.auth.signUp({
      email,
      password,
      options: { data: { team } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-sm rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#dcfce7" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Account created</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-3)" }}>
            Check your email for a confirmation link, then sign in.
          </p>
          <Link
            href="/login"
            className="flex items-center justify-center w-full h-9 rounded-lg text-sm font-medium text-white"
            style={{ background: "#6366f1" }}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

          {/* Header */}
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "#6366f1" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 16.5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v9.5z" />
                <path d="M2 9h20" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Create account</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>AirOps Sea Freight</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Team selector — first */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                Your team
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTeam("pol")}
                  className="flex flex-col items-start px-3 py-3 rounded-lg text-left transition-all"
                  style={{
                    background: team === "pol" ? "#eef2ff" : "var(--surface-2)",
                    border: team === "pol" ? "2px solid #6366f1" : "1.5px solid var(--border)",
                    color: team === "pol" ? "#4f46e5" : "var(--text-2)",
                  }}
                >
                  <span className="text-sm font-semibold leading-none mb-1">POL Team</span>
                  <span className="text-xs opacity-70">Export · Origin side</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeam("france")}
                  className="flex flex-col items-start px-3 py-3 rounded-lg text-left transition-all"
                  style={{
                    background: team === "france" ? "#fdf4ff" : "var(--surface-2)",
                    border: team === "france" ? "2px solid #a855f7" : "1.5px solid var(--border)",
                    color: team === "france" ? "#9333ea" : "var(--text-2)",
                  }}
                >
                  <span className="text-sm font-semibold leading-none mb-1">France Team</span>
                  <span className="text-xs opacity-70">Import · Destination</span>
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Same password again"
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>

            {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg text-sm font-medium text-white"
              style={{ background: loading ? "#a5b4fc" : "#6366f1" }}
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: "var(--text-3)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium" style={{ color: "#6366f1" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
