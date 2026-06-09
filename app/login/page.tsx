"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const sb = createClient();
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      // Supabase returns "Email not confirmed" even when confirmation is disabled
      // for users created while it was enabled — surface a cleaner message
      if (err.message.toLowerCase().includes("email not confirmed")) {
        setError("Your account needs to be confirmed. Contact your admin or try signing up again.");
      } else if (err.message.toLowerCase().includes("invalid login credentials")) {
        setError("Incorrect email or password.");
      } else {
        setError(err.message);
      }
      return;
    }
    router.push("/airops/board");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "#6366f1" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 16.5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v9.5z" />
                <path d="M2 9h20" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              AirOps
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
              Sea freight operations
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  outline: "none",
                }}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-9 rounded-lg px-3 text-sm"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  outline: "none",
                }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg text-sm font-medium text-white"
              style={{ background: loading ? "#a5b4fc" : "#6366f1" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: "var(--text-3)" }}>
            No account?{" "}
            <a href="/signup" className="font-medium" style={{ color: "#6366f1" }}>Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
